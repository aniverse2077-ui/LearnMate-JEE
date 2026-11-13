import { Router, Request, Response } from 'express';
import { getMaxRequestsPerMinute } from '../middleware/rateLimiterAndQuotas';
import { EXPANDED_NTA_58_CHAPTERS } from '../../data/expandedNta58Chapters';
import { getStorageConfigurationStatus } from './storageRoutes';
import { isPaymentsConfigured } from './billingRoutes';
import { isAdminPersistenceReady, isProductionRuntime } from '../persistence/firestoreAdminStore';
import { isAuthAdminReady } from '../studentAuth';

export const commercialAndScaleRouter = Router();

// Health & Readiness Probes for Render / Cloud Run (zero sensitive env exposure)
commercialAndScaleRouter.get('/health', (_req: Request, res: Response) => {
  const firestoreReady = isAdminPersistenceReady();
  const authAdminReady = isAuthAdminReady();
  const storageConfigured = getStorageConfigurationStatus().configured;
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const paymentsConfigured = isPaymentsConfigured();

  const degradedInProd = isProductionRuntime() && (!firestoreReady || !authAdminReady);
  const statusCode = degradedInProd ? 503 : 200;

  res.status(statusCode).json({
    status: degradedInProd ? 'degraded' : 'ok',
    service: 'learnmate-jee-server',
    firestoreReady,
    authAdminReady,
    geminiConfigured,
    paymentsConfigured,
    storageConfigured,
    rateLimitPerMinute: getMaxRequestsPerMinute(),
    ntaChaptersLoaded: EXPANDED_NTA_58_CHAPTERS.length,
    timestamp: new Date().toISOString(),
  });
});
