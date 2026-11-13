import crypto from 'crypto';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import http from 'http';
import { verifyStudentToken } from '../studentAuth';

export interface AuthenticatedRequest extends Request {
  userUid?: string;
  userEmail?: string;
  emailVerified?: boolean;
  isAuthenticated?: boolean;
  clientFingerprint?: string;
  isDevBypass?: boolean;
  requestId?: string;
}

const SENSITIVE_LOG_KEY_RE =
  /(authorization|token|secret|password|apikey|api_key|service_account|signature|cookie)/i;

export function redactSensitiveText(raw: string): string {
  return String(raw || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_GOOGLE_KEY]')
    .replace(/(sk|rk|pk)_(live|test)_[0-9A-Za-z]{12,}/g, '[REDACTED_PAYMENT_KEY]')
    .replace(/whsec_[0-9A-Za-z]{10,}/g, '[REDACTED_WEBHOOK_SECRET]');
}

export function sanitizeLogMeta(meta: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_LOG_KEY_RE.test(k)) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'string') {
      out[k] = redactSensitiveText(v).slice(0, 300);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function logStructuredEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  meta: Record<string, unknown> = {}
): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...sanitizeLogMeta(meta),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export function getClientIp(req: http.IncomingMessage | Request): string {
  // Trust X-Forwarded-For when running explicitly behind a trusted reverse proxy (Cloud Run / Render / TRUST_PROXY)
  if (
    process.env.TRUST_PROXY === 'true' ||
    process.env.RENDER === 'true' ||
    Boolean(process.env.K_SERVICE)
  ) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export function computeRequestFingerprint(
  req: http.IncomingMessage | Request,
  uid: string
): string {
  const ip = getClientIp(req);
  const safeUid = (uid || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return `${ip}:${safeUid}`;
}

function normalizeOriginUrl(raw?: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.origin;
    }
  } catch {
    // ignore malformed URL entries
  }
  return null;
}

export function getConfiguredAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = new Set<string>();
  for (const item of (env.CORS_ALLOWED_ORIGINS || '').split(',')) {
    const norm = normalizeOriginUrl(item);
    if (norm) configured.add(norm);
  }
  for (const candidate of [env.RENDER_EXTERNAL_URL, env.APP_URL, env.SHARED_APP_URL]) {
    const norm = normalizeOriginUrl(candidate);
    if (norm) {
      configured.add(norm);
      if (norm.startsWith('https://ais-dev-')) {
        configured.add(norm.replace('https://ais-dev-', 'https://ais-pre-'));
      } else if (norm.startsWith('https://ais-pre-')) {
        configured.add(norm.replace('https://ais-pre-', 'https://ais-dev-'));
      }
    }
  }
  return Array.from(configured);
}

export function isOriginAllowed(
  origin: string | undefined,
  configuredOrigins: string[] = getConfiguredAllowedOrigins(),
  env: NodeJS.ProcessEnv = process.env,
  requestHeaders?: http.IncomingHttpHeaders
): boolean {
  if (!origin) return true;

  let parsed: URL;
  try {
    parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
  } catch {
    return false;
  }

  if (configuredOrigins.includes(parsed.origin)) return true;

  // Same-origin request check against request Host / X-Forwarded-Host
  if (requestHeaders) {
    const trustProxyHeaders =
      env.TRUST_PROXY === 'true' || env.RENDER === 'true' || Boolean(env.K_SERVICE);
    const forwardedHost = trustProxyHeaders
      ? String(requestHeaders['x-forwarded-host'] || '')
          .split(',')[0]
          .trim()
      : '';
    const directHost = String(requestHeaders.host || '')
      .split(',')[0]
      .trim();
    const effectiveHost = (forwardedHost || directHost).toLowerCase();
    if (effectiveHost && parsed.host.toLowerCase() === effectiveHost) {
      return true;
    }
  }

  const isLocalhost =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '[::1]';
  if (isLocalhost && env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
}

export function createHelmetMiddleware() {
  const isProd = process.env.NODE_ENV === 'production';
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isProd
          ? [
              "'self'",
              'https://apis.google.com',
              'https://accounts.google.com',
              'https://www.gstatic.com',
            ]
          : [
              "'self'",
              "'unsafe-inline'",
              "'unsafe-eval'",
              'https://apis.google.com',
              'https://accounts.google.com',
              'https://www.gstatic.com',
            ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://i.ytimg.com',
          'https://*.googleusercontent.com',
          'https://www.gstatic.com',
        ],
        mediaSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: [
          "'self'",
          'ws:',
          'wss:',
          'https://*.googleapis.com',
          'https://*.firebaseio.com',
          'wss://*.firebaseio.com',
          'https://*.firebaseapp.com',
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          'https://firestore.googleapis.com',
          'https://firebasestorage.googleapis.com',
          'https://accounts.google.com',
          'https://www.youtube.com',
        ],
        frameSrc: [
          "'self'",
          'https://*.firebaseapp.com',
          'https://*.web.app',
          'https://accounts.google.com',
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'", 'https://aistudio.google.com', 'https://*.google.com'],
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  });
}

export function createCorsMiddleware() {
  return cors((req, callback) => {
    const origin = req.headers.origin;
    if (isOriginAllowed(origin, getConfiguredAllowedOrigins(), process.env, req.headers)) {
      callback(null, { origin: true, credentials: true });
    } else {
      callback(new Error('Origin not allowed by LearnMate JEE CORS policy'));
    }
  });
}

export function requestCorrelationMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(incomingId.trim())
      ? incomingId.trim()
      : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      logStructuredEvent(res.statusCode >= 500 ? 'error' : 'info', 'api_request', {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
        uid: req.userUid && req.userUid !== 'anonymous' ? `${req.userUid.slice(0, 6)}...` : 'anonymous',
      });
    }
  });
  next();
}

/**
 * Resolves student identity on incoming API requests without trusting spoofable headers.
 * - Never trusts `x-learnmate-uid` or falls back to `guest_scholar`.
 * - Rejects malformed/expired/invalid Authorization headers with 401.
 * - Allows unauthenticated requests to pass only with `isAuthenticated = false` so public routes can still serve public endpoints while protected routes guard via `requireAuthenticatedStudent`.
 */
export async function authenticateStudentMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  req.isAuthenticated = false;
  req.userUid = 'anonymous';

  if (authHeader) {
    const verification = await verifyStudentToken(authHeader);
    if (!verification.valid) {
      res.status(401).json({
        error: verification.errorCode || 'UNAUTHORIZED_TOKEN',
        errorCode: verification.errorCode || 'UNAUTHORIZED_TOKEN',
        message: verification.reason || 'Invalid or expired authentication token.',
        requestId: req.requestId,
        retryAfterSeconds: 0,
      });
      return;
    }

    req.userUid = verification.uid;
    req.userEmail = verification.email;
    req.emailVerified = verification.emailVerified;
    req.isDevBypass = verification.isDevBypass;
    req.isAuthenticated = true;
    req.clientFingerprint = computeRequestFingerprint(req, verification.uid);
    next();
    return;
  }

  req.clientFingerprint = computeRequestFingerprint(req, 'anonymous');
  next();
}

/**
 * Fail-closed authentication guard for protected routes (/api/ai/*, /api/storage/*, /api/ingest/*, /api/commercial/*).
 */
export function requireAuthenticatedStudent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.isAuthenticated || !req.userUid || req.userUid === 'anonymous') {
    res.status(401).json({
      error: 'AUTH_REQUIRED',
      errorCode: 'AUTH_REQUIRED',
      message: 'Authentication required. Please sign in to access this endpoint.',
      requestId: req.requestId,
      retryAfterSeconds: 0,
    });
    return;
  }
  next();
}
