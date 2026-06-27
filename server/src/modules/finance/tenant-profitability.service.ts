import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { prisma } from '../../infrastructure/database';

export interface TenantProfitability {
  tenantId:       string;
  tenantName:     string;
  leaseCount:     number;
  monthlyRent:    number;
  allocatedCost:  number;
  net:            number;
  marginPct:      number;
}

export interface TenantProfitabilityReport {
  basis: 'sqft' | 'equal' | 'mixed';
  monthsAveraged: number;
  tenants: TenantProfitability[];
}

const MONTHS_AVERAGED = 3;

// Allocate each property's operating expenses to its active leases by share of
// leased square footage (equal split when a property's leases lack sqft), using
// the property's average monthly expense over the last few months. Aggregated
// per tenant so owners can see who is actually profitable after costs.
export async function getTenantProfitability(userId: string): Promise<TenantProfitabilityReport> {
  const now = new Date();
  const windowStart = startOfMonth(subMonths(now, MONTHS_AVERAGED - 1));
  const windowEnd = endOfMonth(now);

  const [expenseByProperty, leases] = await Promise.all([
    prisma.financialRecord.groupBy({
      by: ['propertyId'],
      where: {
        property: { ownerId: userId, deletedAt: null },
        type: 'EXPENSE',
        status: { not: 'VOID' },
        periodStart: { gte: windowStart, lte: windowEnd },
      },
      _sum: { amount: true },
    }),
    prisma.lease.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        property: { ownerId: userId, deletedAt: null },
      },
      select: {
        id: true,
        baseRent: true,
        sqft: true,
        propertyId: true,
        tenant: { select: { id: true, name: true } },
      },
    }),
  ]);

  const monthlyExpenseByProperty = new Map(
    expenseByProperty.map((e) => [e.propertyId, Number(e._sum.amount ?? 0) / MONTHS_AVERAGED]),
  );

  const leasesByProperty = new Map<string, typeof leases>();
  for (const lease of leases) {
    const list = leasesByProperty.get(lease.propertyId);
    if (list) list.push(lease);
    else leasesByProperty.set(lease.propertyId, [lease]);
  }

  type Accum = { tenantId: string; tenantName: string; leaseCount: number; monthlyRent: number; allocatedCost: number };
  const perTenant = new Map<string, Accum>();
  const bases = new Set<'sqft' | 'equal'>();

  for (const [propertyId, propertyLeases] of leasesByProperty) {
    const monthlyExpense = monthlyExpenseByProperty.get(propertyId) ?? 0;
    const useSqft = propertyLeases.every((l) => l.sqft != null && Number(l.sqft) > 0);
    bases.add(useSqft ? 'sqft' : 'equal');

    const weights = propertyLeases.map((l) => (useSqft ? Number(l.sqft) : 1));
    const totalWeight = weights.reduce((s, w) => s + w, 0) || propertyLeases.length;

    propertyLeases.forEach((lease, i) => {
      const allocatedCost = totalWeight > 0 ? monthlyExpense * (weights[i] / totalWeight) : 0;
      const rent = Number(lease.baseRent);
      const existing = perTenant.get(lease.tenant.id);
      if (existing) {
        existing.leaseCount += 1;
        existing.monthlyRent += rent;
        existing.allocatedCost += allocatedCost;
      } else {
        perTenant.set(lease.tenant.id, {
          tenantId: lease.tenant.id,
          tenantName: lease.tenant.name,
          leaseCount: 1,
          monthlyRent: rent,
          allocatedCost,
        });
      }
    });
  }

  const tenants: TenantProfitability[] = [...perTenant.values()]
    .map((t) => {
      const allocatedCost = Math.round(t.allocatedCost);
      const net = Math.round(t.monthlyRent - t.allocatedCost);
      return {
        tenantId: t.tenantId,
        tenantName: t.tenantName,
        leaseCount: t.leaseCount,
        monthlyRent: Math.round(t.monthlyRent),
        allocatedCost,
        net,
        marginPct: t.monthlyRent > 0 ? Math.round((net / t.monthlyRent) * 100) : 0,
      };
    })
    .sort((a, b) => b.net - a.net);

  const basis: TenantProfitabilityReport['basis'] = bases.size === 2 ? 'mixed' : bases.has('sqft') ? 'sqft' : 'equal';

  return { basis, monthsAveraged: MONTHS_AVERAGED, tenants };
}
