import { prisma } from '../../infrastructure/database';
import { subMonths, startOfMonth, endOfMonth, format, addDays } from 'date-fns';

export async function getExecutiveSummary() {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const [
    totalProperties,
    activeLeases,
    thisMonthRevenue,
    lastMonthRevenue,
    openAlerts,
    criticalAlerts,
    expiringIn30,
    expiringIn90,
    occupancyData,
  ] = await Promise.all([
    prisma.property.count({ where: { status: 'ACTIVE' } }),
    prisma.lease.count({ where: { status: 'ACTIVE' } }),
    prisma.financialRecord.aggregate({
      where: { type: 'REVENUE', periodStart: { gte: thisMonthStart }, status: { not: 'VOID' } },
      _sum: { amount: true },
    }),
    prisma.financialRecord.aggregate({
      where: { type: 'REVENUE', periodStart: { gte: lastMonthStart, lte: lastMonthEnd }, status: { not: 'VOID' } },
      _sum: { amount: true },
    }),
    prisma.alert.count({ where: { status: 'OPEN' } }),
    prisma.alert.count({ where: { status: 'OPEN', severity: 'CRITICAL' } }),
    prisma.lease.count({ where: { status: 'ACTIVE', endDate: { lte: addDays(now, 30) } } }),
    prisma.lease.count({ where: { status: 'ACTIVE', endDate: { lte: addDays(now, 90) } } }),
    prisma.property.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        totalUnits: true,
        _count: { select: { leases: { where: { status: 'ACTIVE' } } } },
      },
    }),
  ]);

  const totalUnits = occupancyData.reduce((s, p) => s + p.totalUnits, 0);
  const occupiedUnits = occupancyData.reduce((s, p) => s + p._count.leases, 0);
  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

  const currentRevenue = Number(thisMonthRevenue._sum.amount ?? 0);
  const previousRevenue = Number(lastMonthRevenue._sum.amount ?? 0);
  const revenueGrowth = previousRevenue > 0
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
    : 0;

  return {
    properties: { total: totalProperties },
    leases: {
      active: activeLeases,
      expiringIn30,
      expiringIn90,
    },
    revenue: {
      current: currentRevenue,
      previous: previousRevenue,
      growthPct: Number(revenueGrowth.toFixed(2)),
    },
    alerts: { open: openAlerts, critical: criticalAlerts },
    occupancy: {
      rate: Number(occupancyRate.toFixed(2)),
      occupied: occupiedUnits,
      total: totalUnits,
    },
  };
}

export async function getLeaseDistribution() {
  const [byStatus, byRisk, byType] = await Promise.all([
    prisma.lease.groupBy({ by: ['status'], _count: true }),
    prisma.lease.groupBy({ by: ['renewalRisk'], where: { status: 'ACTIVE' }, _count: true }),
    prisma.lease.groupBy({ by: ['type'], _count: true }),
  ]);

  return { byStatus, byRisk, byType };
}

export async function getPropertyPerformance() {
  const properties = await prisma.property.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      code: true,
      totalUnits: true,
      _count: { select: { leases: { where: { status: 'ACTIVE' } } } },
    },
  });

  const now = new Date();
  const monthStart = startOfMonth(now);

  const result = await Promise.all(
    properties.map(async (p) => {
      const revenue = await prisma.financialRecord.aggregate({
        where: { propertyId: p.id, type: 'REVENUE', periodStart: { gte: monthStart }, status: { not: 'VOID' } },
        _sum: { amount: true },
      });

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        totalUnits: p.totalUnits,
        activeLeases: p._count.leases,
        occupancyRate: p.totalUnits > 0 ? Number(((p._count.leases / p.totalUnits) * 100).toFixed(2)) : 0,
        monthlyRevenue: Number(revenue._sum.amount ?? 0),
      };
    })
  );

  return result.sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
}

export async function getRevenueTrend(months = 12) {
  const now = new Date();
  const trend: Array<{ month: string; revenue: number; expenses: number; net: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);

    const [revenue, expenses] = await Promise.all([
      prisma.financialRecord.aggregate({
        where: { type: 'REVENUE', periodStart: { gte: start, lte: end }, status: { not: 'VOID' } },
        _sum: { amount: true },
      }),
      prisma.financialRecord.aggregate({
        where: { type: 'EXPENSE', periodStart: { gte: start, lte: end }, status: { not: 'VOID' } },
        _sum: { amount: true },
      }),
    ]);

    trend.push({
      month: format(monthDate, 'MMM yy'),
      revenue: Number(revenue._sum.amount ?? 0),
      expenses: Number(expenses._sum.amount ?? 0),
      net: Number(revenue._sum.amount ?? 0) - Number(expenses._sum.amount ?? 0),
    });
  }

  return trend;
}
