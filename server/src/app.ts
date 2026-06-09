import './config/env';
import './lib/sentry';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { Sentry } from './lib/sentry';

import { authRouter } from './modules/auth/auth.routes';
import { propertiesRouter } from './modules/properties/properties.routes';
import { leasesRouter } from './modules/leases/leases.routes';
import { financeRouter } from './modules/finance/finance.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { alertsRouter } from './modules/alerts/alerts.routes';
import { aiRouter } from './modules/ai/ai.routes';
import { tenantsRouter } from './modules/tenants/tenants.routes';
import { workQueueRouter } from './modules/workQueue/work-queue.routes';
import { tasksRouter } from './modules/tasks/tasks.routes';
import { crmRouter } from './modules/crm/crm.routes';
import { documentsRouter } from './modules/documents/documents.routes';
import { automationRouter } from './modules/automation/automation.routes';
import { importRouter } from './modules/import/import.routes';
import { auditRouter } from './modules/audit/audit.routes';
import { demoRouter } from './modules/demo/demo.routes';
import { billingRouter } from './modules/billing/billing.routes';
import { onboardingRouter } from './modules/onboarding/onboarding.routes';
import { teamRouter } from './modules/team/team.routes';
import { organizationRouter } from './modules/organization/organization.routes';
import { exportRouter } from './modules/export/export.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { announcementsRouter } from './modules/announcements/announcements.routes';
import { eventsRouter } from './modules/events/events.routes';
import { supportRouter } from './modules/support/support.routes';

export const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = new Set([
  env.CLIENT_URL,
  env.CLIENT_URL.replace('https://www.', 'https://'),
  env.CLIENT_URL.replace('https://', 'https://www.'),
  'http://localhost:5173',
]);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
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
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
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
app.use('/api/work-queue', workQueueRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/crm', crmRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/automation', automationRouter);
app.use('/api/import', importRouter);
app.use('/api/audit', auditRouter);
app.use('/api/demo', demoRouter);
app.use('/api/billing', billingRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/team', teamRouter);
app.use('/api/organization', organizationRouter);
app.use('/api/export', exportRouter);
app.use('/api/admin', adminRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/support', supportRouter);

// ─── Error Handling ───────────────────────────────────────────────────────────
Sentry.setupExpressErrorHandler(app);
app.use(notFoundHandler);
app.use(errorHandler);
