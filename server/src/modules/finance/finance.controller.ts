import type { Request, Response, NextFunction } from 'express';
import * as service from './finance.service';
import { getRevenueAtRisk } from './revenue-at-risk.service';
import { getTenantProfitability } from './tenant-profitability.service';
import { getLateFeeForecast } from './late-fee-forecast.service';
import { getLateFeePolicySuggestion, applyLateFeePolicy } from './late-fee-policy.service';
import { getCollectionsContext, recordPayment, sendReminder, applyLateFee } from './collections.service';
import { getBudgets, upsertBudget, deleteBudget } from './budget.service';
import { getFinanceIntelligence } from './intelligence/finance-intelligence.service';
import { getForecastOutlook } from './intelligence/forecast-outlook.service';
import { trackFirstInsight } from '../analytics/funnel.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { records, total } = await service.getFinancialRecords(req.query as never, req.user!.id);
    sendPaginated(res, records, total, Number(req.query.page) || 1, Number(req.query.limit) || 20);
  } catch (err) { next(err); }
}

export async function pulse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await service.getFinancialPulse(req.user!.id));
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

export async function intelligence(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await getFinanceIntelligence(req.user!.id));
    void trackFirstInsight(req.user!.id);
  } catch (err) { next(err); }
}

export async function forecastOutlook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await getForecastOutlook(req.user!.id));
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

export async function lateFeePolicySuggestion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await getLateFeePolicySuggestion(req.user!.id));
  } catch (err) { next(err); }
}

export async function lateFeePolicyApply(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await applyLateFeePolicy(req.user!.id, req.body));
  } catch (err) { next(err); }
}

export async function collectionsContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await getCollectionsContext(req.user!.id, req.params.leaseId));
  } catch (err) { next(err); }
}

export async function collectionsRecordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await recordPayment(req.user!.id, req.params.leaseId));
  } catch (err) { next(err); }
}

export async function collectionsRemind(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await sendReminder(req.user!.id, req.params.leaseId));
  } catch (err) { next(err); }
}

export async function collectionsApplyLateFee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await applyLateFee(req.user!.id, req.params.leaseId));
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
