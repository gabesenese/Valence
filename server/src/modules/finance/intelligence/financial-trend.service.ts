import { Prisma } from '@prisma/client';
import { prisma } from '../../../infrastructure/database';
import type { Confidence, Direction, MetricDelta, Sentiment } from './intelligence.types';

function monthWindow(now: Date, offset: number): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m - offset, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - offset + 1, 1, 0, 0, 0, 0) - 1);
  return { start, end };
}

interface MonthTotals {
  revenue: number;
  revenueCount: number;
  expenses: number;
  expenseCount: number;
}

export interface PeriodComparison {
  current: MonthTotals;
  previous: MonthTotals;
  metrics: MetricDelta[];
}

async function monthTotals(userId: string, start: Date, end: Date): Promise<MonthTotals> {
  const where: Prisma.FinancialRecordWhereInput = {
    property: { ownerId: userId, deletedAt: null },
    status: { not: 'VOID' },
    periodStart: { gte: start, lte: end },
  };

  const [rev, exp] = await Promise.all([
    prisma.financialRecord.aggregate({ where: { ...where, type: 'REVENUE' }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.financialRecord.aggregate({ where: { ...where, type: 'EXPENSE' }, _sum: { amount: true }, _count: { _all: true } }),
  ]);

  return {
    revenue: Number(rev._sum.amount ?? 0),
    revenueCount: rev._count._all,
    expenses: Number(exp._sum.amount ?? 0),
    expenseCount: exp._count._all,
  };
}

function direction(deltaAbs: number): Direction {
  if (deltaAbs > 0) return 'up';
  if (deltaAbs < 0) return 'down';
  return 'flat';
}

function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// Revenue/net up = good; expenses up = bad. netIncome trusts the weaker of its inputs.
function dataConfidence(currentCount: number, previousCount: number, noun: string): Confidence {
  if (currentCount > 0 && previousCount > 0) {
    return { level: 'HIGH', basis: `Based on ${currentCount + previousCount} ${noun} records across two months` };
  }
  if (currentCount > 0 || previousCount > 0) {
    return { level: 'MEDIUM', basis: `Based on one month of ${noun} data` };
  }
  return { level: 'LOW', basis: `No ${noun} records yet` };
}

function weaker(a: Confidence, b: Confidence): Confidence {
  const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
  return rank[a.level] <= rank[b.level] ? a : b;
}

export async function getPeriodComparison(userId: string): Promise<PeriodComparison> {
  const now = new Date();
  const cur = monthWindow(now, 0);
  const prev = monthWindow(now, 1);

  const [current, previous] = await Promise.all([
    monthTotals(userId, cur.start, cur.end),
    monthTotals(userId, prev.start, prev.end),
  ]);

  const netCurrent = current.revenue - current.expenses;
  const netPrevious = previous.revenue - previous.expenses;

  const revenueConfidence = dataConfidence(current.revenueCount, previous.revenueCount, 'revenue');
  const expenseConfidence = dataConfidence(current.expenseCount, previous.expenseCount, 'expense');

  // A metric is comparable only when both months actually carry that data. Net income
  // needs both revenue AND expenses complete, otherwise an unbilled current month reads
  // as a huge (false) swing.
  const revenueComparable = current.revenueCount > 0 && previous.revenueCount > 0;
  const expenseComparable = current.expenseCount > 0 && previous.expenseCount > 0;
  const netComparable = revenueComparable && expenseComparable;

  function buildMetric(
    key: MetricDelta['key'],
    label: string,
    cur: number,
    prev: number,
    comparable: boolean,
    goodWhenUp: boolean,
    confidence: Confidence,
  ): MetricDelta {
    const deltaAbs = cur - prev;
    const dir = comparable ? direction(deltaAbs) : 'flat';
    const sentiment: Sentiment = dir === 'flat' ? 'neutral' : dir === 'up' ? (goodWhenUp ? 'good' : 'bad') : goodWhenUp ? 'bad' : 'good';
    return {
      key,
      label,
      current: cur,
      previous: prev,
      deltaAbs,
      deltaPct: comparable ? deltaPct(cur, prev) : null,
      direction: dir,
      sentiment,
      comparable,
      confidence,
    };
  }

  const metrics: MetricDelta[] = [
    buildMetric('revenue', 'Revenue', current.revenue, previous.revenue, revenueComparable, true, revenueConfidence),
    buildMetric('expenses', 'Expenses', current.expenses, previous.expenses, expenseComparable, false, expenseConfidence),
    buildMetric('netIncome', 'Net Income', netCurrent, netPrevious, netComparable, true, weaker(revenueConfidence, expenseConfidence)),
  ];

  return { current, previous, metrics };
}
