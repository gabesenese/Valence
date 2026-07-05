import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

/*
 * Per-user limiters for expensive/sensitive authenticated routes. These sit on
 * top of the permissive global limiter and key by the authenticated user id
 * (these routes always run behind `authenticate`), so one account can't hammer
 * the LLM/upload paths regardless of source IP.
 */
const byUser = (req: Request): string => req.user?.id ?? 'anonymous';

export const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyGenerator: byUser,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests — please slow down.' },
});

export const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: byUser,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many uploads — please slow down.' },
});
