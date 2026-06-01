import { Router } from 'express';
import * as controller from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas';

const router = Router();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.post('/logout', validate(refreshSchema), controller.logout);
router.get('/me', authenticate, controller.getMe);
router.get('/users', authenticate, controller.listUsers);

export { router as authRouter };
