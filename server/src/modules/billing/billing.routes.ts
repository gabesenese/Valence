import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Plan } from '@prisma/client';
import { isAddonKey, type AddonKey } from '../plans/addons';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';
import { env } from '../../config/env';
import { trackEvent } from '../analytics/funnel.service';
import { createCheckoutSession, createAddonCheckout, createPortalSession, handleWebhookEvent } from './billing.service';

const router = Router();

const VALID_PLANS: Plan[] = ['ESSENTIALS', 'PROFESSIONAL', 'EXECUTIVE'];

router.post('/checkout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan } = req.body as { plan?: Plan };
    if (!plan || !VALID_PLANS.includes(plan)) {
      res.status(400).json({ success: false, message: 'Invalid plan' });
      return;
    }
    const u = req.user!;
    const url = await createCheckoutSession(
      { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName },
      plan,
      `${env.CLIENT_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      `${env.CLIENT_URL}/pricing`,
    );
    void trackEvent('upgrade_clicked', u.id, { plan });
    sendSuccess(res, { url });
  } catch (err) {
    next(err);
  }
});

router.post('/addon-checkout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { addon } = req.body as { addon?: string };
    if (!addon || !isAddonKey(addon)) {
      res.status(400).json({ success: false, message: 'Invalid add-on' });
      return;
    }
    const u = req.user!;
    const url = await createAddonCheckout(
      { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName },
      addon as AddonKey,
      `${env.CLIENT_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      `${env.CLIENT_URL}/pricing`,
    );
    void trackEvent('addon_checkout_clicked', u.id, { addon });
    sendSuccess(res, { url });
  } catch (err) {
    next(err);
  }
});

router.post('/portal', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const u = req.user!;
    const url = await createPortalSession(
      { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName },
      `${env.CLIENT_URL}/settings`,
    );
    sendSuccess(res, { url });
  } catch (err) {
    next(err);
  }
});

router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }
    await handleWebhookEvent(req.body as Buffer, sig);
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

export { router as billingRouter };
