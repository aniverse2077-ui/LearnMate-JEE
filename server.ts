import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  authenticateStudentMiddleware,
  createCorsMiddleware,
  createHelmetMiddleware,
} from './src/server/middleware/authAndSecurity';
import { rateLimiterAndQuotaMiddleware } from './src/server/middleware/rateLimiterAndQuotas';
import { aiTutorRouter } from './src/server/routes/aiTutorRoutes';
import { pyqAndCbtRouter } from './src/server/routes/pyqAndCbtRoutes';
import { storageRouter } from './src/server/routes/storageRoutes';
import { commercialAndScaleRouter } from './src/server/routes/commercialAndScaleRoutes';
import { attachVoiceLiveWebSocketServer } from './src/server/ws/voiceLiveServer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createLearnMateExpressApp() {
  const app = express();

  app.use(createHelmetMiddleware());
  app.use(createCorsMiddleware());
  app.use(express.json({ limit: '50mb' }));

  // Public & authenticated commercial / health routes
  app.use('/api', authenticateStudentMiddleware, commercialAndScaleRouter);

  // PYQ packs & server-verified CBT grading routes
  app.use('/api', authenticateStudentMiddleware, pyqAndCbtRouter);

  // Cloud Storage signed upload/download URL routes
  app.use('/api/storage', authenticateStudentMiddleware, storageRouter);

  // Rate-limited & quota-enforced Gemini AI routes
  app.use(
    '/api/ai',
    authenticateStudentMiddleware,
    rateLimiterAndQuotaMiddleware,
    aiTutorRouter
  );

  return app;
}

async function startServer() {
  const app = createLearnMateExpressApp();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT || 3000);

  attachVoiceLiveWebSocketServer(server);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

if (process.env.LEARNMATE_SKIP_AUTO_LISTEN !== 'true') {
  startServer();
}
