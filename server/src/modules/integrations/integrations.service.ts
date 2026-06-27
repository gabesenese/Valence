import { Prisma, type Plan } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { env } from '../../config/env';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import { CONNECTORS, isKnownConnector, getConnector, planAllowsIntegrations, type Connector } from './connector';
import { signOAuthState, verifyOAuthState } from './security';

function providerRedirectUri(provider: string): string {
  if (provider === 'quickbooks') {
    if (!env.QBO_REDIRECT_URI) throw new ValidationError('QuickBooks redirect URI is not configured.');
    return env.QBO_REDIRECT_URI;
  }
  throw new ValidationError('This integration has no OAuth redirect configured.');
}

export async function getAuthorizeUrl(ownerId: string, plan: Plan, provider: string): Promise<{ url: string }> {
  if (!isKnownConnector(provider)) throw new NotFoundError('Integration');
  const impl = getConnector(provider);
  if (!impl?.getAuthUrl) throw new ValidationError("This integration isn't available yet.");
  if (!planAllowsIntegrations(plan)) throw new ForbiddenError('Connecting an integration requires the Professional plan.');
  const state = signOAuthState(ownerId, provider);
  return { url: impl.getAuthUrl(ownerId, state, providerRedirectUri(provider)) };
}

export async function completeOAuth(provider: string, code: string, params: Record<string, string>): Promise<{ ownerId: string }> {
  const decoded = verifyOAuthState(params.state ?? '');
  if (decoded.provider !== provider) throw new ValidationError('OAuth state mismatch.');
  const impl = getConnector(provider);
  if (!impl) throw new ValidationError("This integration isn't available yet.");

  const config = await impl.connect(decoded.ownerId, {
    type: 'oauth_code',
    code,
    redirectUri: providerRedirectUri(provider),
    params,
  });
  await prisma.integration.upsert({
    where:  { ownerId_provider: { ownerId: decoded.ownerId, provider } },
    create: { ownerId: decoded.ownerId, provider, status: 'CONNECTED', config: config as Prisma.InputJsonValue },
    update: { status: 'CONNECTED', config: config as Prisma.InputJsonValue },
  });
  return { ownerId: decoded.ownerId };
}

// Next run of the 12-hourly sync cron (00:00 / 12:00 UTC).
function nextSyncTime(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  if (now.getUTCHours() < 12) next.setUTCHours(12);
  else { next.setUTCHours(0); next.setUTCDate(now.getUTCDate() + 1); }
  return next;
}

async function computeHealth(ownerId: string, provider: string, lastSyncedAt: Date | null) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [runs, lastSuccess, refCounts] = await Promise.all([
    prisma.syncRun.findMany({ where: { ownerId, provider, startedAt: { gte: since } }, select: { status: true } }),
    prisma.syncRun.findFirst({ where: { ownerId, provider, status: { in: ['success', 'partial'] } }, orderBy: { startedAt: 'desc' }, select: { finishedAt: true } }),
    prisma.externalRef.groupBy({ by: ['entityType'], where: { ownerId, provider }, _count: { _all: true } }),
  ]);
  const completed = runs.filter((r) => r.status !== 'running');
  const successes = completed.filter((r) => r.status === 'success' || r.status === 'partial').length;
  return {
    lastSyncedAt,
    lastSuccessAt: lastSuccess?.finishedAt ?? null,
    nextSyncAt: nextSyncTime().toISOString(),
    failures30d: completed.filter((r) => r.status === 'error').length,
    successRatePct: completed.length ? Math.round((successes / completed.length) * 100) : null,
    records: Object.fromEntries(refCounts.map((r) => [r.entityType, r._count._all])),
  };
}

export async function listIntegrations(ownerId: string) {
  const connections = await prisma.integration.findMany({ where: { ownerId } });
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  return Promise.all(CONNECTORS.map(async (c) => {
    const conn = byProvider.get(c.id);
    const connected = conn?.status === 'CONNECTED';
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      category: c.category,
      authType: c.authType,
      status: c.status,
      available: Boolean(getConnector(c.id)),
      connection: conn
        ? { status: conn.status, lastSyncedAt: conn.lastSyncedAt, requestedAt: conn.createdAt }
        : null,
      health: connected ? await computeHealth(ownerId, c.id, conn!.lastSyncedAt) : null,
    };
  }));
}

export async function connectIntegration(ownerId: string, plan: Plan, provider: string, config?: Record<string, unknown>) {
  if (!isKnownConnector(provider)) throw new NotFoundError('Integration');

  const impl = getConnector(provider);
  // Real connector → validate credentials and mark connected (Professional-gated).
  // Otherwise record the user's interest so we can prioritise the integration.
  let storedConfig = config;
  if (impl) {
    if (!planAllowsIntegrations(plan)) {
      throw new ForbiddenError('Connecting an integration requires the Professional plan.');
    }
    storedConfig = await impl.connect(ownerId, { type: 'api_key', credentials: (config ?? {}) as Record<string, string> });
  }

  const status = impl ? 'CONNECTED' : 'REQUESTED';
  const configValue = storedConfig ? { config: storedConfig as Prisma.InputJsonValue } : {};
  return prisma.integration.upsert({
    where:  { ownerId_provider: { ownerId, provider } },
    create: { ownerId, provider, status, ...configValue },
    update: { status, ...configValue },
  });
}

export async function disconnectIntegration(ownerId: string, provider: string) {
  if (!isKnownConnector(provider)) throw new NotFoundError('Integration');
  const impl = getConnector(provider);
  if (impl?.disconnect) await impl.disconnect(ownerId);
  await prisma.integration.deleteMany({ where: { ownerId, provider } });
  return { disconnected: true };
}

export async function syncIntegration(ownerId: string, plan: Plan, provider: string) {
  if (!isKnownConnector(provider)) throw new NotFoundError('Integration');

  const impl = getConnector(provider);
  if (!impl) {
    throw new ValidationError("This integration isn't available yet — we'll let you know when it goes live.");
  }
  if (!planAllowsIntegrations(plan)) {
    throw new ForbiddenError('Syncing an integration requires the Professional plan.');
  }

  return runSync(ownerId, provider, impl);
}

// Core sync (used by manual sync and the scheduled cron). Every run is recorded
// as a SyncRun so the UI can show a transparent timeline.
async function runSync(ownerId: string, provider: string, impl: Connector) {
  const run = await prisma.syncRun.create({ data: { ownerId, provider, status: 'running' } });
  try {
    const summary = await impl.sync(ownerId);
    const status = summary.errors.length > 0 ? 'partial' : 'success';
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status, finishedAt: new Date(), summary: summary as unknown as Prisma.InputJsonValue },
    });
    await prisma.integration.update({
      where: { ownerId_provider: { ownerId, provider } },
      data:  { lastSyncedAt: new Date(), status: 'CONNECTED' },
    });
    return { runId: run.id, summary };
  } catch (e) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: 'error', finishedAt: new Date(), error: e instanceof Error ? e.message : 'Unknown error' },
    });
    throw e;
  }
}

// Scheduled sync over all live connections whose provider has a registered
// connector. Per-integration failures are isolated (recorded in the SyncRun).
export async function runScheduledSyncs(): Promise<{ synced: number }> {
  const connections = await prisma.integration.findMany({ where: { status: 'CONNECTED' } });
  let synced = 0;
  for (const conn of connections) {
    const impl = getConnector(conn.provider);
    if (!impl) continue;
    try {
      await runSync(conn.ownerId, conn.provider, impl);
      synced += 1;
    } catch {
      /* failure already captured in its SyncRun */
    }
  }
  return { synced };
}

export async function getSyncHistory(ownerId: string, provider: string, limit = 20) {
  return prisma.syncRun.findMany({
    where: { ownerId, provider },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
}
