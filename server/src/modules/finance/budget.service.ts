import { startOfMonth, endOfMonth, format } from 'date-fns';
import { prisma } from '../../infrastructure/database';

export interface BudgetVarianceItem {
  id:          string;
  category:    string;
  propertyId:  string | null;
  budget:      number;
  actual:      number;
  variance:    number;
  variancePct: number | null;
  status:      'over' | 'under' | 'on_track';
}

// Compare each budget against this month's actual expenses in that category
// (owner-scoped; per-property when the budget targets a property).
export async function getBudgets(userId: string) {
  const budgets = await prisma.budget.findMany({ where: { ownerId: userId }, orderBy: { category: 'asc' } });
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);

  const items: BudgetVarianceItem[] = await Promise.all(
    budgets.map(async (b) => {
      const agg = await prisma.financialRecord.aggregate({
        where: {
          property: { ownerId: userId, deletedAt: null },
          type: 'EXPENSE',
          status: { not: 'VOID' },
          category: b.category,
          ...(b.propertyId && { propertyId: b.propertyId }),
          periodStart: { gte: start, lte: end },
        },
        _sum: { amount: true },
      });
      const budget = Number(b.monthlyAmount);
      const actual = Number(agg._sum.amount ?? 0);
      const variance = actual - budget;
      const tolerance = budget * 0.02;
      return {
        id: b.id,
        category: b.category,
        propertyId: b.propertyId,
        budget,
        actual,
        variance,
        variancePct: budget > 0 ? Math.round((variance / budget) * 100) : null,
        status: variance > tolerance ? 'over' : variance < -tolerance ? 'under' : 'on_track',
      };
    }),
  );

  return { month: format(now, 'MMM yyyy'), items };
}

export async function upsertBudget(
  userId: string,
  input: { category: string; propertyId?: string | null; monthlyAmount: number },
) {
  const propertyId = input.propertyId ?? null;
  const existing = await prisma.budget.findFirst({
    where: { ownerId: userId, category: input.category, propertyId },
  });
  if (existing) {
    return prisma.budget.update({ where: { id: existing.id }, data: { monthlyAmount: input.monthlyAmount } });
  }
  return prisma.budget.create({
    data: { ownerId: userId, category: input.category, propertyId, monthlyAmount: input.monthlyAmount },
  });
}

export async function deleteBudget(userId: string, id: string) {
  await prisma.budget.deleteMany({ where: { id, ownerId: userId } });
  return { success: true };
}
