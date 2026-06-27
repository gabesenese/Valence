import { Prisma, type Plan } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import { CONNECTORS, isKnownConnector, getConnector, planAllowsIntegrations } from './connector';

export async function listIntegrations(ownerId: string) {
  const connections = await prisma.integration.findMany({ where: { ownerId } });
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  return CONNECTORS.map((c) => {
    const conn = byProvider.get(c.id);
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
    };
  });
}

export async function connectIntegration(ownerId: string, plan: Plan, provider: string, config?: Record<string, unknown>) {
  if (!isKnownConnector(provider)) throw new NotFoundError('Integration');

  const impl = getConnector(provider);
  // Real connector → validate credentials and mark connected (Professional-gated).
  // Otherwise record the user's interest so we can prioritise the integration.
  if (impl) {
    if (!planAllowsIntegrations(plan)) {
      throw new ForbiddenError('Connecting an integration requires the Professional plan.');
    }
    await impl.connect(ownerId, { type: 'api_key', credentials: (config ?? {}) as Record<string, string> });
  }

  const status = impl ? 'CONNECTED' : 'REQUESTED';
  const configValue = config ? { config: config as Prisma.InputJsonValue } : {};
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

  const result = await impl.sync(ownerId);
  await prisma.integration.update({
    where: { ownerId_provider: { ownerId, provider } },
    data:  { lastSyncedAt: new Date(), status: 'CONNECTED' },
  });
  return result;
}
