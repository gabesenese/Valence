import { Router } from 'express';
import * as controller from './finance.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { requireOwner } from '../../middleware/ownership';
import { planGate } from '../../middleware/planGate';
import {
  createFinancialRecordSchema,
  updateFinancialRecordSchema,
  financeQuerySchema,
  revenueTrendQuerySchema,
  expenseBreakdownQuerySchema,
  expenseTrendQuerySchema,
  forecastQuerySchema,
  upsertBudgetSchema,
  applyLateFeePolicySchema,
} from './finance.schemas';

const router = Router();

router.use(authenticate);
router.use(planGate('ESSENTIALS')); // Finance is a paid feature — FREE tier upgrades to view it.

router.get('/summary', controller.summary);
router.get('/intelligence', controller.intelligence);
router.get('/forecast-outlook', controller.forecastOutlook);
router.get('/trend', validate(revenueTrendQuerySchema, 'query'), controller.trend);
router.get('/at-risk', controller.atRisk);
router.get('/expense-breakdown', validate(expenseBreakdownQuerySchema, 'query'), controller.expenseBreakdown);
router.get('/expense-trend', validate(expenseTrendQuerySchema, 'query'), controller.expenseTrend);
router.get('/tenant-profitability', controller.tenantProfitability);
router.get('/forecast', validate(forecastQuerySchema, 'query'), controller.forecast);
router.get('/late-fee-forecast', controller.lateFeeForecast);
router.get('/late-fee-policy/suggestion', controller.lateFeePolicySuggestion);
router.post('/late-fee-policy/apply', authorize('ANALYST'), validate(applyLateFeePolicySchema), controller.lateFeePolicyApply);
router.get('/pulse', controller.pulse);
router.get('/collections/:leaseId', controller.collectionsContext);
router.post('/collections/:leaseId/record-payment', authorize('ANALYST'), controller.collectionsRecordPayment);
router.post('/collections/:leaseId/remind', authorize('ANALYST'), controller.collectionsRemind);
router.post('/collections/:leaseId/apply-late-fee', authorize('ANALYST'), controller.collectionsApplyLateFee);
router.get('/budgets', controller.budgets);
router.put('/budgets', authorize('ANALYST'), validate(upsertBudgetSchema), controller.setBudget);
router.delete('/budgets/:id', authorize('ANALYST'), controller.removeBudget);
router.get('/', validate(financeQuerySchema, 'query'), controller.list);
router.get('/:id', requireOwner('financialRecord'), controller.show);
router.post('/', authorize('ANALYST'), validate(createFinancialRecordSchema), controller.create);
router.patch('/:id', authorize('ANALYST'), requireOwner('financialRecord'), validate(updateFinancialRecordSchema), controller.update);

export { router as financeRouter };
