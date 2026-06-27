import type { Request, Response, NextFunction } from 'express';
import * as service from './finance.service';
import { getRevenueAtRisk } from './revenue-at-risk.service';
import { getTenantProfitability } from './tenant-profitability.service';
import { getLateFeeForecast } from './late-fee-forecast.service';
import { getBudgets, upsertBudget, deleteBudget } from './budget.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { records, total } = await service.getFinancialRecords(req.query as never, req.user!.id);
    sendPaginated(res, records, total, Number(req.query.page) || 1, Number(req.query.limit) || 20);
  } catch (err) { next(err); }
}

export async function show(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getFinancialRecordById(req.params.id));
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.createFinancialRecord(req.body), 201);
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.updateFinancialRecord(req.params.id, req.body));
  } catch (err) { next(err); }
}

export async function trend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getRevenueTrend(req.query as never, req.user!.id));
  } catch (err) { next(err); }
}

export async function summary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getFinancialSummary(req.query.propertyId as string | undefined, req.user!.id));
  } catch (err) { next(err); }
}

export async function atRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await getRevenueAtRisk(req.user!.id));
  } catch (err) { next(err); }
}

export async function expenseBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getExpenseBreakdown(req.query as never, req.user!.id));
  } catch (err) { next(err); }
}

export async function expenseTrend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getExpenseTrend(req.query as never, req.user!.id));
  } catch (err) { next(err); }
}

export async function tenantProfitability(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await getTenantProfitability(req.user!.id));
  } catch (err) { next(err); }
}

export async function forecast(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getNoiForecast(req.query as never, req.user!.id));
  } catch (err) { next(err); }
}

export async function lateFeeForecast(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await getLateFeeForecast(req.user!.id));
  } catch (err) { next(err); }
}

export async function budgets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await getBudgets(req.user!.id));
  } catch (err) { next(err); }
}

export async function setBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await upsertBudget(req.user!.id, req.body));
  } catch (err) { next(err); }
}

export async function removeBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await deleteBudget(req.user!.id, req.params.id));
  } catch (err) { next(err); }
}
