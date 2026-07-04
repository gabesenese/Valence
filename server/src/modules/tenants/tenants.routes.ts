import { Router } from 'express';
import * as controller from './tenants.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { requireOwner } from '../../middleware/ownership';
import { validate } from '../../middleware/validate';
import { createTenantSchema, updateTenantSchema } from './tenants.schemas';

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', requireOwner('tenant'), controller.show);
router.post('/', authorize('ANALYST'), validate(createTenantSchema), controller.create);
router.patch('/:id', authorize('ANALYST'), requireOwner('tenant'), validate(updateTenantSchema), controller.update);

export { router as tenantsRouter };
