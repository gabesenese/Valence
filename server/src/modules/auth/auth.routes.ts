import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas';

const router = Router();

// Strict limiters for auth endpoints
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5,  standardHeaders: true, legacyHeaders: false });
const demoLimiter  = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

// ─── Public ───────────────────────────────────────────────────────────────────

router.post('/demo-session',      demoLimiter,                           controller.demoLogin);
router.post('/register',         loginLimiter, validate(registerSchema), controller.register);
router.post('/login',            loginLimiter, validate(loginSchema),    controller.login);
router.post('/refresh',          validate(refreshSchema),                controller.refresh);
router.post('/logout',           validate(refreshSchema),                controller.logout);
router.post('/forgot-password',  forgotLimiter,                          controller.forgotPassword);
router.post('/reset-password',                                           controller.resetPassword);
router.post('/mfa/verify',       loginLimiter,                           controller.verifyMfaChallenge);
router.get( '/verify-email',                                             controller.verifyEmail);

// ─── Authenticated ────────────────────────────────────────────────────────────

router.get(   '/me',                      authenticate, controller.getMe);
router.post(  '/claim-trial',             authenticate, controller.claimTrial);
router.patch( '/me',                      authenticate, controller.updateProfile);
router.patch( '/me/email',                authenticate, controller.changeEmail);
router.patch( '/me/password',             authenticate, controller.changePassword);
router.post(  '/me/resend-verification',  authenticate, controller.resendVerification);
router.post(  '/mfa/setup',               authenticate, controller.setupMfa);
router.post(  '/mfa/enable',              authenticate, controller.enableMfa);
router.post(  '/mfa/disable',             authenticate, controller.disableMfa);
router.get(   '/sessions',                authenticate, controller.listSessions);
router.delete('/sessions/all',            authenticate, controller.revokeAllSessions);
router.delete('/sessions/:id',            authenticate, controller.revokeSession);

// ─── Admin ────────────────────────────────────────────────────────────────────

router.get(   '/users',          authenticate,                              controller.listUsers);
router.patch( '/users/:id/role', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), controller.updateUserRole);
router.patch( '/users/:id/active', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), controller.setUserActive);
router.patch( '/users/:id/plan', authenticate, authorize('SUPER_ADMIN'),   controller.setUserPlan);

export { router as authRouter };
