import { Router } from 'express';
import * as controller from './leases.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { createLeaseSchema, updateLeaseSchema, leaseQuerySchema } from './leases.schemas';

const router = Router();

router.use(authenticate);

router.get('/stats', controller.stats);
router.get('/', validate(leaseQuerySchema, 'query'), controller.list);
router.get('/:id', controller.show);
router.post('/', authorize('ANALYST'), validate(createLeaseSchema), controller.create);
router.patch('/:id', authorize('ANALYST'), validate(updateLeaseSchema), controller.update);
router.delete('/:id', authorize('ADMIN'), controller.remove);

export { router as leasesRouter };
