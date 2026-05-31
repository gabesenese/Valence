import { prisma } from '../../infrastructure/database';
import { subMonths, startOfMonth, endOfMonth, format, addDays, differenceInDays } from 'date-fns';

export interface PortfolioInsight {
  id: string;
  category: 'LEASE' | 'FINANCIAL' | 'OPERATIONAL' | 'RISK';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  context: string;
  href: string;
  value?: string;
}

export async function getInsights(): Promise<PortfolioInsight[]> {
  const now = new Date();
  const insights: PortfolioInsight[] = [];

  // ── Critical expiring leases ────────────────────────────────────────────────
  const criticalLeases = await prisma.lease.findMany({
    where: { status: 'ACTIVE', endDate: { gte: now, lte: addDays(now, 60) } },
    include: { property: true, tenant: true },
    orderBy: { endDate: 'asc' },
  });

  for (const lease of criticalLeases) {
    const days = differenceInDays(lease.endDate, now);
    const severity = days <= 30 ? 'critical' : 'warning';
    insights.push({
      id: `lease-expiry-${lease.id}`,
      category: 'LEASE',
      severity,
      message: `Lease ${lease.leaseNumber} requires action within ${days} day${days !== 1 ? 's' : ''}`,
      context: `${lease.tenant.name} · ${lease.property.name}${lease.renewalDate ? ' · Renewal scheduled' : ' · No renewal recorded'}`,
      href: `/leases/${lease.id}`,
      value: `${days}d`,
    });
  }

  // ── Revenue variance vs 3-month baseline ────────────────────────────────────
  const thisMonthStart = startOfMonth(now);
  const properties = await prisma.property.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  });

  for (const property of properties) {
    const historical: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const mo = subMonths(now, i);
      const agg = await prisma.financialRecord.aggregate({
        where: {
          propertyId: property.id, type: 'REVENUE',
          periodStart: { gte: startOfMonth(mo), lte: endOfMonth(mo) },
          status: { not: 'VOID' },
        },
        _sum: { amount: true },
      });
      historical.push(Number(agg._sum.amount ?? 0));
    }

    const baseline = historical.reduce((s, v) => s + v, 0) / 3;
    if (baseline === 0) continue;

    const currentAgg = await prisma.financialRecord.aggregate({
      where: {
        propertyId: property.id, type: 'REVENUE',
        periodStart: { gte: thisMonthStart },
        status: { not: 'VOID' },
      },
      _sum: { amount: true },
    });
    const current = Number(currentAgg._sum.amount ?? 0);
    const deviationPct = ((current - baseline) / baseline) * 100;

    if (Math.abs(deviationPct) >= 7) {
      const isDown = deviationPct < 0;
      insights.push({
        id: `revenue-variance-${property.id}`,
        category: 'FINANCIAL',
        severity: Math.abs(deviationPct) >= 20 ? 'critical' : 'warning',
        message: `Revenue variance at ${property.name} exceeds historical baseline by ${Math.abs(Math.round(deviationPct))}%`,
        context: isDown
          ? `Current $${Math.round(current).toLocaleString()} vs baseline $${Math.round(baseline).toLocaleString()} — possible leakage or missing records`
          : `Current $${Math.round(current).toLocaleString()} vs baseline $${Math.round(baseline).toLocaleString()} — above average`,
        href: `/finance`,
        value: `${isDown ? '▼' : '▲'}${Math.abs(Math.round(deviationPct))}%`,
      });
    }
  }

  // ── Properties below NOI threshold ──────────────────────────────────────────
  const portfolioNOIs: number[] = [];
  for (const property of properties) {
    const [rev, exp] = await Promise.all([
      prisma.financialRecord.aggregate({
        where: { propertyId: property.id, type: 'REVENUE', periodStart: { gte: thisMonthStart }, status: { not: 'VOID' } },
        _sum: { amount: true },
      }),
      prisma.financialRecord.aggregate({
        where: { propertyId: property.id, type: 'EXPENSE', periodStart: { gte: thisMonthStart }, status: { not: 'VOID' } },
        _sum: { amount: true },
      }),
    ]);
    const noi = Number(rev._sum.amount ?? 0) - Number(exp._sum.amount ?? 0);
    portfolioNOIs.push(noi);
  }

  const avgNOI = portfolioNOIs.length > 0 ? portfolioNOIs.reduce((s, v) => s + v, 0) / portfolioNOIs.length : 0;
  for (let i = 0; i < properties.length; i++) {
    const noi = portfolioNOIs[i];
    if (avgNOI > 0 && noi < avgNOI * 0.6) {
      insights.push({
        id: `noi-below-threshold-${properties[i].id}`,
        category: 'FINANCIAL',
        severity: 'warning',
        message: `${properties[i].name} performance below expected NOI threshold`,
        context: `NOI $${Math.round(noi).toLocaleString()} vs portfolio average $${Math.round(avgNOI).toLocaleString()}`,
        href: `/properties/${properties[i].id}`,
        value: `$${noi >= 1000 ? (noi / 1000).toFixed(0) + 'K' : Math.round(noi)}`,
      });
    }
  }

  // ── Expiring leases summary (90-day window) ──────────────────────────────────
  const expiring90 = await prisma.lease.count({
    where: { status: 'ACTIVE', endDate: { gte: now, lte: addDays(now, 90) } },
  });
  if (expiring90 > 0) {
    const expiring30 = await prisma.lease.count({
      where: { status: 'ACTIVE', endDate: { gte: now, lte: addDays(now, 30) } },
    });
    insights.push({
      id: 'portfolio-renewal-pipeline',
      category: 'LEASE',
      severity: expiring30 > 0 ? 'warning' : 'info',
      message: `${expiring90} lease${expiring90 !== 1 ? 's' : ''} expiring within 90 days across portfolio`,
      context: expiring30 > 0
        ? `${expiring30} require immediate attention within 30 days`
        : 'No immediate expirations — monitor 60-90 day window',
      href: '/leases',
      value: `${expiring90}`,
    });
  }

  // ── Open critical alerts summary ─────────────────────────────────────────────
  const criticalAlertCount = await prisma.alert.count({
    where: { status: 'OPEN', severity: 'CRITICAL' },
  });
  if (criticalAlertCount > 0) {
    insights.push({
      id: 'critical-alerts-open',
      category: 'RISK',
      severity: 'critical',
      message: `${criticalAlertCount} critical alert${criticalAlertCount !== 1 ? 's' : ''} require immediate attention`,
      context: 'Unresolved critical issues detected across portfolio',
      href: '/alerts',
      value: `${criticalAlertCount}`,
    });
  }

  // Sort: critical first, then warning, then info; within each, lease > financial > operational > risk
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return insights.slice(0, 8); // cap at 8 insights
}

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
    prisma.lease.count({ where: { status: 'ACTIVE', endDate: { gte: now, lte: addDays(now, 30) } } }),
    prisma.lease.count({ where: { status: 'ACTIVE', endDate: { gte: now, lte: addDays(now, 90) } } }),
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
