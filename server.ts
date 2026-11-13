import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  authenticateStudentMiddleware,
  createCorsMiddleware,
  createHelmetMiddleware,
  logStructuredEvent,
  requestCorrelationMiddleware,
  requireAuthenticatedStudent,
} from './src/server/middleware/authAndSecurity';
import {
  createRouteRateLimiter,
  rateLimiterAndQuotaMiddleware,
} from './src/server/middleware/rateLimiterAndQuotas';
import { aiTutorRouter } from './src/server/routes/aiTutorRoutes';
import { pyqAndCbtRouter } from './src/server/routes/pyqAndCbtRoutes';
import { storageRouter } from './src/server/routes/storageRoutes';
import { commercialAndScaleRouter } from './src/server/routes/commercialAndScaleRoutes';
import { billingRouter } from './src/server/routes/billingRoutes';
import { ingestionRouter } from './src/server/routes/ingestionRoutes';
import { accountAndOpsRouter } from './src/server/routes/accountAndOpsRoutes';
import { attachVoiceLiveWebSocketServer } from './src/server/ws/voiceLiveServer';
import {
  generateWithModelFallback,
  getModelRoutingConfig,
  getValidatedGenAIClient,
  sendStructuredUpstreamError,
} from './src/server/coreStudyEngine';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createLearnMateExpressApp() {
  const app = express();

  const trustProxy =
    process.env.TRUST_PROXY === 'true' ||
    process.env.RENDER === 'true' ||
    Boolean(process.env.K_SERVICE);
  app.set('trust proxy', trustProxy ? 1 : false);

  app.use(requestCorrelationMiddleware);
  app.use(createHelmetMiddleware());
  app.use(createCorsMiddleware());

  // Large JSON limit restricted strictly to multimodal / multi-page ingestion endpoints
  const heavyUploadJson = express.json({ limit: '15mb' });
  app.use('/api/ai/analyze', heavyUploadJson);
  app.use('/api/ai/transcribe', heavyUploadJson);
  app.use('/api/ai/image-edit', heavyUploadJson);
  app.use('/api/ingest', heavyUploadJson);

  // Preserve raw body for HMAC webhook verification on /api/commercial/webhook
  app.use(
    '/api/commercial/webhook',
    express.json({
      limit: '1mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );

  // Safe 1 MB default JSON limit for all other routes
  app.use(express.json({ limit: '1mb' }));

  // Public health probe
  app.use('/api', authenticateStudentMiddleware, commercialAndScaleRouter);

  // Strict rate-limited public sample preview for Landing Page "Try a Question"
  const publicSampleLimiter = createRouteRateLimiter({
    maxPerMinute: 6,
    keyPrefix: 'public_sample',
    errorCode: 'PUBLIC_SAMPLE_RATE_LIMIT',
  });
  app.post(
    '/api/public/sample-question',
    publicSampleLimiter,
    async (req: Request, res: Response) => {
      try {
        const rawPrompt = String(req.body?.prompt || '').trim();
        if (!rawPrompt || rawPrompt.length > 500) {
          res.status(400).json({
            errorCode: 'INVALID_SAMPLE_PROMPT',
            message: 'Enter a concise JEE question (1–500 characters).',
          });
          return;
        }
        const models = getModelRoutingConfig();
        const ai = getValidatedGenAIClient();
        const { result } = await generateWithModelFallback(
          models.lite,
          models.fast,
          (model) =>
            ai.models.generateContent({
              model,
              contents: `Briefly solve or explain this JEE question in 3 crisp bullet points with $...$ LaTeX formatting (no mention of KaTeX): ${rawPrompt}`,
            })
        );
        res.json({ text: result.text ?? '' });
      } catch (error: any) {
        sendStructuredUpstreamError(res, error, '/api/public/sample-question');
      }
    }
  );

  // Commercial catalog (/plans), webhook (/webhook), and authenticated billing/entitlements
  app.use('/api/commercial', authenticateStudentMiddleware, billingRouter);

  // Fail-closed authenticated account deletion & parity-checked legacy migration
  app.use(
    '/api/account',
    authenticateStudentMiddleware,
    requireAuthenticatedStudent,
    accountAndOpsRouter
  );

  // PYQ packs, exam blueprints & server CBT grading + authenticated issue reporting
  app.use('/api', authenticateStudentMiddleware, pyqAndCbtRouter);

  // Fail-closed authenticated multi-page PDF / YouTube ingestion routes
  app.use(
    '/api/ingest',
    authenticateStudentMiddleware,
    requireAuthenticatedStudent,
    ingestionRouter
  );

  // Fail-closed authenticated Cloud Storage signed URL & status routes
  app.use(
    '/api/storage',
    authenticateStudentMiddleware,
    requireAuthenticatedStudent,
    storageRouter
  );

  // Fail-closed authenticated, rate-limited & quota-enforced Gemini AI routes
  app.use(
    '/api/ai',
    authenticateStudentMiddleware,
    requireAuthenticatedStudent,
    rateLimiterAndQuotaMiddleware,
    aiTutorRouter
  );

  // Structured JSON error handler (never leaks raw stack traces to clients)
  app.use((err: any, req: any, res: Response, _next: NextFunction) => {
    const status = Number(err?.status || err?.statusCode || 500);
    const isCors = /CORS/i.test(String(err?.message || ''));
    logStructuredEvent('error', 'express_unhandled_error', {
      requestId: req?.requestId,
      status: isCors ? 403 : status,
      message: String(err?.message || 'Server error'),
    });
    res.status(isCors ? 403 : status).json({
      errorCode: isCors ? 'CORS_FORBIDDEN' : err?.type || 'INTERNAL_SERVER_ERROR',
      message: isCors
        ? 'Origin not allowed by CORS policy.'
        : status < 500
        ? err?.message || 'Malformed request.'
        : 'An unexpected server error occurred.',
      requestId: req?.requestId,
    });
  });

  return app;
}

async function startServer() {
  const app = createLearnMateExpressApp();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT || 3000);

  attachVoiceLiveWebSocketServer(server);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const hmrPort = process.env.HMR_PORT ? Number(process.env.HMR_PORT) : undefined;
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ...(hmrPort ? { hmr: { port: hmrPort } } : {}),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LearnMate JEE server running on http://localhost:${PORT}`);
  });
}

const isNodeTestProcess =
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.argv.some((arg) => arg === '--test' || arg.endsWith('.test.ts'));

if (process.env.LEARNMATE_SKIP_AUTO_LISTEN !== 'true' && !isNodeTestProcess) {
  startServer();
}
