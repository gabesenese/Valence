import { Router } from 'express';
import * as controller from './finance.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import {
  createFinancialRecordSchema,
  updateFinancialRecordSchema,
  financeQuerySchema,
  revenueTrendQuerySchema,
} from './finance.schemas';

const router = Router();

router.use(authenticate);

router.get('/summary', controller.summary);
router.get('/trend', validate(revenueTrendQuerySchema, 'query'), controller.trend);
router.get('/', validate(financeQuerySchema, 'query'), controller.list);
router.get('/:id', controller.show);
router.post('/', authorize('ANALYST'), validate(createFinancialRecordSchema), controller.create);
router.patch('/:id', authorize('ANALYST'), validate(updateFinancialRecordSchema), controller.update);

export { router as financeRouter };
