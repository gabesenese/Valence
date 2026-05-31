import { Router } from 'express';
import * as controller from './tenants.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.show);

export { router as tenantsRouter };
