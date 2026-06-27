import { prisma } from '../../infrastructure/database';

// Maps a provider's external entity id to the Valence record so re-syncs upsert
// instead of creating duplicates. Used by concrete connectors (Phase 1+).
export type RefEntityType = 'property' | 'lease' | 'tenant' | 'financial_record';

export async function resolveInternalId(
  ownerId: string,
  provider: string,
  entityType: RefEntityType,
  externalId: string,
): Promise<string | null> {
  const ref = await prisma.externalRef.findUnique({
    where: { ownerId_provider_entityType_externalId: { ownerId, provider, entityType, externalId } },
  });
  return ref?.internalId ?? null;
}

export async function recordRef(
  ownerId: string,
  provider: string,
  entityType: RefEntityType,
  externalId: string,
  internalId: string,
): Promise<void> {
  await prisma.externalRef.upsert({
    where: { ownerId_provider_entityType_externalId: { ownerId, provider, entityType, externalId } },
    create: { ownerId, provider, entityType, externalId, internalId },
    update: { internalId },
  });
}
