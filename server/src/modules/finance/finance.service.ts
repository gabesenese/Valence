import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { NotFoundError } from '../../utils/errors';
import { subMonths, startOfMonth, endOfMonth, parseISO, format } from 'date-fns';
import { recordChange } from '../changes/changes.service';
import type {
  CreateFinancialRecordInput,
  UpdateFinancialRecordInput,
  FinanceQuery,
  RevenueTrendQuery,
  ExpenseBreakdownQuery,
  ExpenseTrendQuery,
} from './finance.schemas';

export async function getFinancialRecords(query: FinanceQuery, userId: string) {
  const { page, limit, type, status, category, propertyId, leaseId, from, to } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.FinancialRecordWhereInput = {
    property: { ownerId: userId, deletedAt: null },
    ...(type && { type }),
    ...(status && { status }),
    ...(category && { category }),
    ...(propertyId && { propertyId }),
    ...(leaseId && { leaseId }),
    ...((from || to) && {
      periodStart: {
        ...(from && { gte: parseISO(from) }),
        ...(to && { lte: parseISO(to) }),
      },
    }),
  };

  const [records, total] = await Promise.all([
    prisma.financialRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: { periodStart: 'desc' },
      include: {
        property: { select: { id: true, name: true, code: true } },
        lease: { select: { id: true, leaseNumber: true } },
      },
    }),
    prisma.financialRecord.count({ where }),
  ]);

  return { records, total };
}

export async function getFinancialRecordById(id: string) {
  const record = await prisma.financialRecord.findUnique({
    where: { id },
    include: {
      property: true,
      lease: { include: { tenant: true } },
    },
  });
  if (!record) throw new NotFoundError('Financial record');
  return record;
}

export async function createFinancialRecord(input: CreateFinancialRecordInput) {
  const { periodStart, periodEnd, dueDate, paidDate, ...rest } = input;
  return prisma.financialRecord.create({
    data: {
      ...rest,
      periodStart: parseISO(periodStart),
      periodEnd: parseISO(periodEnd),
      dueDate: dueDate ? parseISO(dueDate) : undefined,
      paidDate: paidDate ? parseISO(paidDate) : undefined,
    },
    include: {
      property: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function updateFinancialRecord(id: string, input: UpdateFinancialRecordInput) {
  const prev = await getFinancialRecordById(id);
  const { periodStart, periodEnd, dueDate, paidDate, ...rest } = input;
  const record = await prisma.financialRecord.update({
    where: { id },
    data: {
      ...rest,
      ...(periodStart && { periodStart: parseISO(periodStart) }),
      ...(periodEnd && { periodEnd: parseISO(periodEnd) }),
      ...(dueDate && { dueDate: parseISO(dueDate) }),
      ...(paidDate && { paidDate: parseISO(paidDate) }),
    },
  });

  if (record.status === 'RECONCILED' && prev.status !== 'RECONCILED' && record.type === 'REVENUE') {
    void recordChange({
      type: 'REVENUE_RECONCILED',
      entityType: 'financial_record',
      entityId: record.id,
      title: 'Revenue reconciled',
      amount: Number(record.amount),
      propertyId: record.propertyId,
    });
  }

  return record;
}

export async function getRevenueTrend(query: RevenueTrendQuery, userId: string) {
  const { propertyId, months } = query;
  const now = new Date();

  const trend: Array<{ month: string; revenue: number; expenses: number; net: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);

    const where: Prisma.FinancialRecordWhereInput = {
      property: { ownerId: userId, deletedAt: null },
      ...(propertyId && { propertyId }),
      periodStart: { gte: start, lte: end },
      status: { not: 'VOID' },
    };

    const [revenue, expenses] = await Promise.all([
      prisma.financialRecord.aggregate({
        where: { ...where, type: 'REVENUE' },
        _sum: { amount: true },
      }),
      prisma.financialRecord.aggregate({
        where: { ...where, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
    ]);

    const rev = Number(revenue._sum.amount ?? 0);
    const exp = Number(expenses._sum.amount ?? 0);

    trend.push({
      month: format(monthDate, 'MMM yyyy'),
      revenue: rev,
      expenses: exp,
      net: rev - exp,
    });
  }

  return trend;
}

export async function getFinancialSummary(propertyId: string | undefined, userId: string) {
  const where: Prisma.FinancialRecordWhereInput = {
    property: { ownerId: userId, deletedAt: null },
    ...(propertyId && { propertyId }),
    status: { not: 'VOID' },
  };

  const [revenue, expenses, flagged, pending] = await Promise.all([
    prisma.financialRecord.aggregate({ where: { ...where, type: 'REVENUE' }, _sum: { amount: true } }),
    prisma.financialRecord.aggregate({ where: { ...where, type: 'EXPENSE' }, _sum: { amount: true } }),
    prisma.financialRecord.count({ where: { ...where, status: 'FLAGGED' } }),
    prisma.financialRecord.count({ where: { ...where, status: 'PENDING' } }),
  ]);

  const totalRevenue = Number(revenue._sum.amount ?? 0);
  const totalExpenses = Number(expenses._sum.amount ?? 0);

  return {
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
    flaggedRecords: flagged,
    pendingRecords: pending,
  };
}

export async function getExpenseBreakdown(query: ExpenseBreakdownQuery, userId: string) {
  const { propertyId, from, to } = query;

  const where: Prisma.FinancialRecordWhereInput = {
    property: { ownerId: userId, deletedAt: null },
    type: 'EXPENSE',
    status: { not: 'VOID' },
    ...(propertyId && { propertyId }),
    ...((from || to) && {
      periodStart: {
        ...(from && { gte: parseISO(from) }),
        ...(to && { lte: parseISO(to) }),
      },
    }),
  };

  const grouped = await prisma.financialRecord.groupBy({
    by: ['category'],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });

  const categories = grouped
    .map((g) => ({
      category: g.category ?? 'UNCATEGORIZED',
      total: Number(g._sum.amount ?? 0),
      count: g._count._all,
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const totalExpenses = categories.reduce((sum, c) => sum + c.total, 0);

  return { totalExpenses, categories };
}

export async function getExpenseTrend(query: ExpenseTrendQuery, userId: string) {
  const { propertyId, months } = query;
  const now = new Date();

  const buckets = Array.from({ length: months }, (_, idx) => {
    const d = subMonths(now, months - 1 - idx);
    return { label: format(d, 'MMM yyyy'), start: startOfMonth(d), end: endOfMonth(d) };
  });

  const perBucket = await Promise.all(
    buckets.map((b) =>
      prisma.financialRecord.groupBy({
        by: ['category'],
        where: {
          property: { ownerId: userId, deletedAt: null },
          type: 'EXPENSE',
          status: { not: 'VOID' },
          ...(propertyId && { propertyId }),
          periodStart: { gte: b.start, lte: b.end },
        },
        _sum: { amount: true },
      }),
    ),
  );

  const catTotals = new Map<string, number[]>();
  perBucket.forEach((groups, i) => {
    for (const g of groups) {
      const cat = g.category ?? 'UNCATEGORIZED';
      if (!catTotals.has(cat)) catTotals.set(cat, new Array(months).fill(0));
      catTotals.get(cat)![i] = Number(g._sum.amount ?? 0);
    }
  });

  const categories = [...catTotals.entries()]
    .map(([category, totals]) => {
      const latest = totals[totals.length - 1];
      const prior = totals.slice(0, -1);
      const priorAvg = prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : 0;
      const deltaPct = priorAvg > 0 ? Math.round(((latest - priorAvg) / priorAvg) * 100) : null;
      return {
        category,
        totals,
        latest,
        priorAvg: Math.round(priorAvg),
        deltaPct,
        total: totals.reduce((s, v) => s + v, 0),
      };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.latest - a.latest);

  return { months: buckets.map((b) => b.label), categories };
}
