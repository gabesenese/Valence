import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { trackEvent, type FunnelEventType } from '../analytics/funnel.service';
import { tryAuthenticate } from '../../middleware/authenticate';

const router = Router();

const limiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });

const ALLOWED: Set<string> = new Set(['visitor', 'setup_complete']);

router.post('/', limiter, tryAuthenticate, async (req: Request, res: Response) => {
  const { event, meta } = req.body as { event?: string; meta?: Record<string, unknown> };
  if (!event || !ALLOWED.has(event)) { res.status(204).end(); return; }
  void trackEvent(event as FunnelEventType, req.user?.id ?? null, meta);
  res.status(204).end();
});

export { router as eventsRouter };
