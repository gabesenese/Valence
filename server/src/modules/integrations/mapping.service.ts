import { prisma } from '../../infrastructure/database';
import {
  loadAttributionContext,
  resolveProperty,
  materializeExpense,
  type SourceTags,
  type ExpensePayload,
} from './attribution.service';

export interface MappingQueue {
  entities: { sourceType: string; value: string; count: number }[];
  untaggedCount: number;
  pendingTotal: number;
  properties: { id: string; code: string; name: string }[];
}

export async function getMappingQueue(ownerId: string, provider: string): Promise<MappingQueue> {
  const [pending, properties] = await Promise.all([
    prisma.pendingSyncRecord.findMany({ where: { ownerId, provider }, select: { sourceTags: true } }),
    prisma.property.findMany({ where: { ownerId, deletedAt: null }, select: { id: true, code: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const entities = new Map<string, { sourceType: string; value: string; count: number }>();
  let untaggedCount = 0;

  for (const p of pending) {
    const tags = (p.sourceTags ?? {}) as SourceTags;
    const present = ([['class', tags.class], ['location', tags.location], ['customer', tags.customer]] as const)
      .filter(([, v]) => Boolean(v)) as [string, string][];
    if (present.length === 0) { untaggedCount += 1; continue; }
    for (const [sourceType, value] of present) {
      const key = `${sourceType}:${value}`;
      const e = entities.get(key) ?? { sourceType, value, count: 0 };
      e.count += 1;
      entities.set(key, e);
    }
  }

  return {
    entities: [...entities.values()].sort((a, b) => b.count - a.count),
    untaggedCount,
    pendingTotal: pending.length,
    properties,
  };
}

// Re-resolve every queued record against the current mappings/properties and
// materialize the ones that now resolve. Returns how many were resolved.
async function resolveQueue(ownerId: string, provider: string): Promise<number> {
  const ctx = await loadAttributionContext(ownerId, provider);
  const pending = await prisma.pendingSyncRecord.findMany({ where: { ownerId, provider } });
  let resolved = 0;
  for (const p of pending) {
    const propertyId = resolveProperty((p.sourceTags ?? {}) as SourceTags, ctx);
    if (!propertyId) continue;
    await materializeExpense(ownerId, provider, p.externalId, p.payload as unknown as ExpensePayload, propertyId);
    await prisma.pendingSyncRecord.delete({ where: { id: p.id } });
    resolved += 1;
  }
  return resolved;
}

export async function createMapping(
  ownerId: string,
  provider: string,
  sourceType: string,
  sourceValue: string,
  propertyId: string,
): Promise<{ resolved: number }> {
  await prisma.integrationMapping.upsert({
    where:  { ownerId_provider_sourceType_sourceValue: { ownerId, provider, sourceType, sourceValue } },
    create: { ownerId, provider, sourceType, sourceValue, propertyId },
    update: { propertyId },
  });
  return { resolved: await resolveQueue(ownerId, provider) };
}

// Directly assign queued records (untagged, or a chosen sourceType/value group) to
// a property — for data QuickBooks doesn't tag.
export async function assignPending(
  ownerId: string,
  provider: string,
  propertyId: string,
  filter: { untaggedOnly?: boolean; sourceType?: string; sourceValue?: string },
): Promise<{ resolved: number }> {
  const pending = await prisma.pendingSyncRecord.findMany({ where: { ownerId, provider } });
  let resolved = 0;
  for (const p of pending) {
    const tags = (p.sourceTags ?? {}) as SourceTags;
    const tagged = Boolean(tags.class || tags.location || tags.customer);
    if (filter.untaggedOnly && tagged) continue;
    if (filter.sourceType && filter.sourceValue) {
      const value = (tags as Record<string, string | null | undefined>)[filter.sourceType];
      if (value !== filter.sourceValue) continue;
    }
    await materializeExpense(ownerId, provider, p.externalId, p.payload as unknown as ExpensePayload, propertyId);
    await prisma.pendingSyncRecord.delete({ where: { id: p.id } });
    resolved += 1;
  }
  return { resolved };
}
