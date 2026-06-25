import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { PM_PROVIDERS, isKnownProvider, getProviderImpl } from './providers';

export async function listIntegrations(ownerId: string) {
  const connections = await prisma.integration.findMany({ where: { ownerId } });
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  return PM_PROVIDERS.map((p) => {
    const conn = byProvider.get(p.id);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      available: Boolean(getProviderImpl(p.id)),
      connection: conn
        ? { status: conn.status, lastSyncedAt: conn.lastSyncedAt, requestedAt: conn.createdAt }
        : null,
    };
  });
}

export async function connectIntegration(ownerId: string, provider: string, config?: Record<string, unknown>) {
  if (!isKnownProvider(provider)) throw new NotFoundError('Integration');

  const impl = getProviderImpl(provider);
  // Real provider available → validate credentials and mark connected.
  // Otherwise record the user's interest so we can prioritise the integration.
  const status = impl ? 'CONNECTED' : 'REQUESTED';
  if (impl) await impl.connect(config ?? {});

  const configValue = config ? { config: config as Prisma.InputJsonValue } : {};
  return prisma.integration.upsert({
    where:  { ownerId_provider: { ownerId, provider } },
    create: { ownerId, provider, status, ...configValue },
    update: { status, ...configValue },
  });
}

export async function disconnectIntegration(ownerId: string, provider: string) {
  if (!isKnownProvider(provider)) throw new NotFoundError('Integration');
  await prisma.integration.deleteMany({ where: { ownerId, provider } });
  return { disconnected: true };
}

export async function syncIntegration(ownerId: string, provider: string) {
  if (!isKnownProvider(provider)) throw new NotFoundError('Integration');

  const impl = getProviderImpl(provider);
  if (!impl) {
    throw new ValidationError("This integration isn't available yet — we'll let you know when it goes live.");
  }

  const result = await impl.sync(ownerId);
  await prisma.integration.update({
    where: { ownerId_provider: { ownerId, provider } },
    data:  { lastSyncedAt: new Date(), status: 'CONNECTED' },
  });
  return result;
}
