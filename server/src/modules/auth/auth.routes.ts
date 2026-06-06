import { Router } from 'express';
import * as controller from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas';

const router = Router();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.post('/logout', validate(refreshSchema), controller.logout);
router.get('/me', authenticate, controller.getMe);
router.get('/users', authenticate, controller.listUsers);
router.patch('/users/:id/role', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), controller.updateUserRole);
router.patch('/users/:id/active', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), controller.setUserActive);
router.patch('/users/:id/plan', authenticate, authorize('SUPER_ADMIN'), controller.setUserPlan);

export { router as authRouter };
