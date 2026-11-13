import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authAndSecurity';
import {
  getDailyUidQuotaSnapshot,
  getMaxRequestsPerMinute,
  setStudentSubscriptionTier,
} from '../middleware/rateLimiterAndQuotas';
import { EXPANDED_NTA_58_CHAPTERS } from '../../data/expandedNta58Chapters';

export const commercialAndScaleRouter = Router();

// Health & Readiness Probes for Render / Cloud Run
commercialAndScaleRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'learnmate-jee-server',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    rateLimitPerMinute: getMaxRequestsPerMinute(),
    ntaChaptersLoaded: EXPANDED_NTA_58_CHAPTERS.length,
    timestamp: new Date().toISOString(),
  });
});

// Student Entitlements & Daily Quota Telemetry (/api/commercial/entitlements)
commercialAndScaleRouter.get(
  '/commercial/entitlements',
  (req: AuthenticatedRequest, res: Response) => {
    const uid = req.userUid || 'anonymous';
    const quota = getDailyUidQuotaSnapshot(uid);
    res.json({
      uid,
      tier: quota.tier,
      quota,
      features: {
        unlimitedCbtMocks: quota.tier === 'pro',
        twelveHourYoutubeMarathons: true,
        voiceClassroomTutor: true,
        interactive2DVectorDiagramMaker: true,
        cloudStorageCrossDeviceSync: true,
      },
    });
  }
);

// Upgrade or Switch Student Subscription Tier (/api/commercial/upgrade)
commercialAndScaleRouter.post(
  '/commercial/upgrade',
  (req: AuthenticatedRequest, res: Response) => {
    const uid = req.userUid || 'anonymous';
    const tier = req.body?.tier === 'free' ? 'free' : 'pro';
    setStudentSubscriptionTier(uid, tier);
    const quota = getDailyUidQuotaSnapshot(uid);
    res.json({
      status: 'upgraded',
      uid,
      tier,
      quota,
    });
  }
);
