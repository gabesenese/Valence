import { app } from './app';
import { connectDatabase, disconnectDatabase } from './infrastructure/database';
import { logger } from './utils/logger';
import { runAnomalyScan } from './modules/alerts/anomaly.service';
import { runAllRules } from './modules/automation/automation.service';
import { cleanupDemoAccounts } from './modules/auth/auth.service';
import { purgeStaleTrashed } from './modules/trash/trash.service';
import { runScheduledBackups } from './modules/backup/backup.service';
import { sendDailyBriefs } from './modules/brief/brief.service';
import { runScheduledSyncs } from './modules/integrations/integrations.service';
import { env } from './config/env';
import cron from 'node-cron';
import { mkdirSync } from 'fs';
import path from 'path';

async function start() {
  await connectDatabase();

  try { mkdirSync(path.resolve('uploads/documents'), { recursive: true }); } catch {}

  const server = app.listen(env.PORT, () => {
    logger.info(`Valence API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  const scan = () =>
    runAnomalyScan()
      .then(({ total, breakdown }) => {
        if (total > 0) logger.info(`Anomaly scan: ${total} new alerts`, breakdown);
      })
      .catch((err) => logger.warn('Anomaly scan failed', { error: err }));

  cron.schedule('0 */6 * * *', scan);
  scan();

  cron.schedule('0 * * * *', () => {
    cleanupDemoAccounts()
      .then((n) => { if (n > 0) logger.info(`Demo cleanup: removed ${n} expired demo accounts`); })
      .catch((err) => logger.warn('Demo cleanup failed', { error: err }));
  });

  const automate = () =>
    runAllRules()
      .then(({ total, tasksCreated }) => {
        if (tasksCreated > 0)
          logger.info(`Automation: ran ${total} rules, created ${tasksCreated} tasks`);
      })
      .catch((err) => logger.warn('Automation run failed', { error: err }));

  cron.schedule('0 * * * *', automate);
  automate();

  cron.schedule('0 2 * * *', () => {
    purgeStaleTrashed()
      .then(() => logger.info('Trash purge: stale items permanently deleted'))
      .catch((err) => logger.warn('Trash purge failed', { error: err }));
  });

  cron.schedule('0 3 * * *', () => {
    runScheduledBackups()
      .then(() => logger.info('Scheduled backups completed'))
      .catch((err) => logger.warn('Scheduled backup run failed', { error: err }));
  });

  cron.schedule('0 8 * * *', () => {
    sendDailyBriefs()
      .then(({ sent, skipped }) => { if (sent > 0) logger.info(`Daily brief: sent ${sent}, skipped ${skipped} empty`); })
      .catch((err) => logger.warn('Daily brief run failed', { error: err }));
  });

  cron.schedule('0 */12 * * *', () => {
    runScheduledSyncs()
      .then(({ synced }) => { if (synced > 0) logger.info(`Integration sync: refreshed ${synced} connection(s)`); })
      .catch((err) => logger.warn('Scheduled integration sync failed', { error: err }));
  });

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
