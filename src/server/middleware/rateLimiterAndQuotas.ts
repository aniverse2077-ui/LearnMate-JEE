import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, computeRequestFingerprint } from './authAndSecurity';

export interface TokenBucketState {
  tokens: number;
  lastRefillMs: number;
}

export interface DailyUidQuotaState {
  uid: string;
  tier: 'free' | 'pro';
  dayIso: string;
  requestsUsed: number;
  tokensUsed: number;
  maxRequestsPerDay: number;
  maxTokensPerDay: number;
}

const rateLimitBuckets = new Map<string, TokenBucketState>();
const dailyQuotaStore = new Map<string, DailyUidQuotaState>();
const userTierStore = new Map<string, 'free' | 'pro'>();

export function getMaxRequestsPerMinute(): number {
  return Math.max(1, Number(process.env.AI_REQUESTS_PER_MINUTE || 20));
}

export function setStudentSubscriptionTier(uid: string, tier: 'free' | 'pro'): void {
  userTierStore.set(uid, tier);
  const existing = dailyQuotaStore.get(uid);
  if (existing) {
    existing.tier = tier;
    existing.maxRequestsPerDay = tier === 'pro' ? 500 : 25;
    existing.maxTokensPerDay = tier === 'pro' ? 500_000 : 25_000;
  }
}

export function getStudentSubscriptionTier(uid: string): 'free' | 'pro' {
  return userTierStore.get(uid) || 'free';
}

export function consumeTokenBucket(
  fingerprint: string,
  maxPerMinute = getMaxRequestsPerMinute(),
  nowMs = Date.now()
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const bucket = rateLimitBuckets.get(fingerprint) || {
    tokens: maxPerMinute,
    lastRefillMs: nowMs,
  };

  const elapsedMinutes = Math.max(0, (nowMs - bucket.lastRefillMs) / 60000);
  if (elapsedMinutes > 0) {
    bucket.tokens = Math.min(
      maxPerMinute,
      bucket.tokens + elapsedMinutes * maxPerMinute
    );
    bucket.lastRefillMs = nowMs;
  }

  if (bucket.tokens < 1) {
    const deficit = 1 - bucket.tokens;
    const retryAfterSeconds = Math.max(2, Math.ceil((deficit / maxPerMinute) * 60));
    rateLimitBuckets.set(fingerprint, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  bucket.tokens -= 1;
  rateLimitBuckets.set(fingerprint, bucket);
  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    retryAfterSeconds: 0,
  };
}

export async function consumeDailyUidQuota(
  uid: string,
  estimatedTokens = 650
): Promise<{ allowed: boolean; state: DailyUidQuotaState }> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const tier = getStudentSubscriptionTier(uid);
  const maxRequestsPerDay = tier === 'pro' ? 500 : 25;
  const maxTokensPerDay = tier === 'pro' ? 500_000 : 25_000;

  // Optional Upstash Redis REST atomic increment when configured
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upstashUrl && upstashToken) {
    try {
      const redisKey = `learnmate:quota:${todayIso}:${uid}`;
      const resp = await fetch(`${upstashUrl}/incr/${encodeURIComponent(redisKey)}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
      if (resp.ok) {
        const data = (await resp.json()) as { result?: number };
        const count = Number(data.result || 1);
        const state: DailyUidQuotaState = {
          uid,
          tier,
          dayIso: todayIso,
          requestsUsed: count,
          tokensUsed: count * estimatedTokens,
          maxRequestsPerDay,
          maxTokensPerDay,
        };
        dailyQuotaStore.set(uid, state);
        return {
          allowed: count <= maxRequestsPerDay,
          state,
        };
      }
    } catch {
      // Fallback to in-memory atomic counter
    }
  }

  const current = dailyQuotaStore.get(uid);
  const state: DailyUidQuotaState =
    current && current.dayIso === todayIso
      ? current
      : {
          uid,
          tier,
          dayIso: todayIso,
          requestsUsed: 0,
          tokensUsed: 0,
          maxRequestsPerDay,
          maxTokensPerDay,
        };

  state.tier = tier;
  state.maxRequestsPerDay = maxRequestsPerDay;
  state.maxTokensPerDay = maxTokensPerDay;

  if (state.requestsUsed + 1 > state.maxRequestsPerDay) {
    return { allowed: false, state };
  }

  state.requestsUsed += 1;
  state.tokensUsed += estimatedTokens;
  dailyQuotaStore.set(uid, state);
  return { allowed: true, state };
}

export function getDailyUidQuotaSnapshot(uid: string): DailyUidQuotaState {
  const todayIso = new Date().toISOString().slice(0, 10);
  const tier = getStudentSubscriptionTier(uid);
  const existing = dailyQuotaStore.get(uid);
  if (existing && existing.dayIso === todayIso) {
    return existing;
  }
  return {
    uid,
    tier,
    dayIso: todayIso,
    requestsUsed: 0,
    tokensUsed: 0,
    maxRequestsPerDay: tier === 'pro' ? 500 : 25,
    maxTokensPerDay: tier === 'pro' ? 500_000 : 25_000,
  };
}

export function resetRateLimitersForTest(): void {
  rateLimitBuckets.clear();
  dailyQuotaStore.clear();
  userTierStore.clear();
}

export async function rateLimiterAndQuotaMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const uid = req.userUid || 'anonymous';
  const fingerprint = req.clientFingerprint || computeRequestFingerprint(req, uid);

  const bucketResult = consumeTokenBucket(fingerprint);
  if (!bucketResult.allowed) {
    res.setHeader('Retry-After', String(bucketResult.retryAfterSeconds));
    res.status(429).json({
      errorCode: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit of ${getMaxRequestsPerMinute()} AI requests/minute exceeded. Please wait ${bucketResult.retryAfterSeconds}s and retry.`,
      retryAfterSeconds: bucketResult.retryAfterSeconds,
    });
    return;
  }

  const quotaResult = await consumeDailyUidQuota(uid);
  if (!quotaResult.allowed) {
    res.status(429).json({
      errorCode: 'DAILY_QUOTA_EXCEEDED',
      message: `Daily ${quotaResult.state.tier.toUpperCase()} tier quota (${quotaResult.state.maxRequestsPerDay} AI requests/day) reached. Upgrade to LearnMate Pro Aspirant for 500 daily AI scans.`,
      retryAfterSeconds: 60,
      quota: quotaResult.state,
    });
    return;
  }

  next();
}
