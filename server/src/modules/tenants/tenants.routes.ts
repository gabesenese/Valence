import { Router } from 'express';
import * as controller from './tenants.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { requireOwner } from '../../middleware/ownership';

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', requireOwner('tenant'), controller.show);
router.post('/', authorize('ANALYST'), controller.create);
router.patch('/:id', authorize('ANALYST'), requireOwner('tenant'), controller.update);

export { router as tenantsRouter };
