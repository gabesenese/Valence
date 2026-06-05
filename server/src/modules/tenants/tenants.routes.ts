import { Router } from 'express';
import * as controller from './tenants.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.show);
router.post('/', authorize('ANALYST'), controller.create);
router.patch('/:id', authorize('ANALYST'), controller.update);

export { router as tenantsRouter };
