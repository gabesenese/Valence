import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { recordRef } from './external-ref.service';

// Tags an external expense line carries that could identify a property.
export interface SourceTags {
  class?: string | null;
  location?: string | null;
  customer?: string | null;
}

// Prepared expense ready to become a FinancialRecord once a property is known.
export interface ExpensePayload {
  amount: number;
  periodStart: string; // ISO
  category: string;
  description: string;
  source: string;
  entity: string;
  qboId: string;
}

const norm = (s: string) => s.toLowerCase().trim();

export interface AttributionContext {
  byCode: Map<string, string>;
  byName: Map<string, string>;
  mapped: Map<string, string>; // `${sourceType}:${normValue}` -> propertyId
}

export async function loadAttributionContext(ownerId: string, provider: string): Promise<AttributionContext> {
  const [properties, mappings] = await Promise.all([
    prisma.property.findMany({ where: { ownerId, deletedAt: null }, select: { id: true, code: true, name: true } }),
    prisma.integrationMapping.findMany({ where: { ownerId, provider } }),
  ]);
  return {
    byCode: new Map(properties.map((p) => [norm(p.code), p.id])),
    byName: new Map(properties.map((p) => [norm(p.name), p.id])),
    mapped: new Map(mappings.map((m) => [`${m.sourceType}:${norm(m.sourceValue)}`, m.propertyId])),
  };
}

// Deterministic chain: Property Code → Property Name → stored Class → Location →
// Customer mapping. Returns null when nothing matches confidently (→ queue).
export function resolveProperty(tags: SourceTags, ctx: AttributionContext): string | null {
  const candidates = [tags.class, tags.location, tags.customer].filter(Boolean) as string[];
  for (const t of candidates) { const id = ctx.byCode.get(norm(t)); if (id) return id; }
  for (const t of candidates) { const id = ctx.byName.get(norm(t)); if (id) return id; }
  for (const [type, val] of [['class', tags.class], ['location', tags.location], ['customer', tags.customer]] as const) {
    if (val) { const id = ctx.mapped.get(`${type}:${norm(val)}`); if (id) return id; }
  }
  return null;
}

export async function materializeExpense(
  ownerId: string,
  provider: string,
  externalId: string,
  payload: ExpensePayload,
  propertyId: string,
): Promise<string> {
  const created = await prisma.financialRecord.create({
    data: {
      propertyId,
      type: 'EXPENSE',
      status: 'RECONCILED',
      amount: payload.amount,
      periodStart: new Date(payload.periodStart),
      periodEnd: new Date(payload.periodStart),
      category: payload.category,
      description: payload.description,
      metadata: { source: payload.source, entity: payload.entity, qboId: payload.qboId } as Prisma.InputJsonValue,
    },
  });
  await recordRef(ownerId, provider, 'financial_record', externalId, created.id);
  return created.id;
}
