import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { blockDemo } from '../../middleware/blockDemo';
import { blockWhileImpersonating } from '../../middleware/impersonation';
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5,  standardHeaders: true, legacyHeaders: false });
const demoLimiter  = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });


router.post('/demo-session',      demoLimiter,                           controller.demoLogin);
router.post('/register',         loginLimiter, validate(registerSchema), controller.register);
router.post('/login',            loginLimiter, validate(loginSchema),    controller.login);
router.post('/refresh',          validate(refreshSchema),                controller.refresh);
router.post('/logout',           validate(refreshSchema),                controller.logout);
router.post('/forgot-password',  forgotLimiter,                          controller.forgotPassword);
router.post('/reset-password',   forgotLimiter,                          controller.resetPassword);
router.post('/mfa/verify',       loginLimiter,                           controller.verifyMfaChallenge);
router.get( '/verify-email',                                             controller.verifyEmail);


router.get(   '/me',                      authenticate, controller.getMe);
router.post(  '/claim-trial',             authenticate, controller.claimTrial);
router.patch( '/me',                      authenticate, controller.updateProfile);
router.patch( '/me/preferences',          authenticate, controller.updatePreferences);
router.patch( '/me/email',                authenticate, blockWhileImpersonating, blockDemo, controller.changeEmail);
router.patch( '/me/password',             authenticate, blockWhileImpersonating, blockDemo, controller.changePassword);
router.post(  '/me/resend-verification',  authenticate, controller.resendVerification);
router.post(  '/mfa/setup',               authenticate, blockWhileImpersonating, blockDemo, controller.setupMfa);
router.post(  '/mfa/enable',              authenticate, blockWhileImpersonating, blockDemo, controller.enableMfa);
router.post(  '/mfa/disable',             authenticate, blockWhileImpersonating, blockDemo, controller.disableMfa);
router.get(   '/sessions',                authenticate, controller.listSessions);
router.delete('/sessions/all',            authenticate, blockDemo, controller.revokeAllSessions);
router.delete('/sessions/:id',            authenticate, blockDemo, controller.revokeSession);


router.get(   '/users',          authenticate,                              controller.listUsers);
router.patch( '/users/:id/role', authenticate, authorize('SUPER_ADMIN'), blockDemo, controller.updateUserRole);
router.patch( '/users/:id/active', authenticate, authorize('SUPER_ADMIN'), blockDemo, controller.setUserActive);
router.delete('/users/:id/membership', authenticate, authorize('SUPER_ADMIN'), blockDemo, controller.removeMember);
router.patch( '/users/:id/plan', authenticate, authorize('SUPER_ADMIN'),   blockDemo, controller.setUserPlan);

export { router as authRouter };
