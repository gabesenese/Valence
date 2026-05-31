import './config/env';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { env } from './config/env';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './infrastructure/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import { authRouter } from './modules/auth/auth.routes';
import { propertiesRouter } from './modules/properties/properties.routes';
import { leasesRouter } from './modules/leases/leases.routes';
import { financeRouter } from './modules/finance/finance.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { alertsRouter } from './modules/alerts/alerts.routes';
import { aiRouter } from './modules/ai/ai.routes';
import { tenantsRouter } from './modules/tenants/tenants.routes';
import { runAnomalyScan } from './modules/alerts/anomaly.service';

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests' },
}));

// ─── Parsing + Compression ────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/properties', propertiesRouter);
app.use('/api/leases', leasesRouter);
app.use('/api/finance', financeRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/tenants', tenantsRouter);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    logger.info(`Valence API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // Run anomaly detection after startup — non-blocking
  setTimeout(() => {
    runAnomalyScan()
      .then(({ total, breakdown }) => {
        if (total > 0) logger.info(`Anomaly scan: ${total} new alerts`, breakdown);
      })
      .catch((err) => logger.warn('Anomaly scan failed', { error: err }));
  }, 3000);

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
