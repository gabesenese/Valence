import Stripe from 'stripe';
import type { Plan } from '@prisma/client';
import { env } from '../../config/env';
import { setPlan } from '../plans/plans.service';

// ─── Client ───────────────────────────────────────────────────────────────────

function getStripe() {
  if (!env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY)');
  return new Stripe(env.STRIPE_SECRET_KEY);
}

type StripeClient = ReturnType<typeof getStripe>;

// ─── Price mapping ────────────────────────────────────────────────────────────

function priceIdForPlan(plan: Plan): string {
  const id = {
    ESSENTIALS:   env.STRIPE_PRICE_ESSENTIALS,
    PROFESSIONAL: env.STRIPE_PRICE_PROFESSIONAL,
    EXECUTIVE:    env.STRIPE_PRICE_EXECUTIVE,
  }[plan];
  if (!id) throw new Error(`No Stripe price configured for plan: ${plan}`);
  return id;
}

function planForPriceId(priceId: string): Plan | undefined {
  if (priceId === env.STRIPE_PRICE_ESSENTIALS)   return 'ESSENTIALS';
  if (priceId === env.STRIPE_PRICE_PROFESSIONAL) return 'PROFESSIONAL';
  if (priceId === env.STRIPE_PRICE_EXECUTIVE)    return 'EXECUTIVE';
  return undefined;
}

// ─── Customer helpers ─────────────────────────────────────────────────────────

type UserInfo = { id: string; email: string; firstName: string; lastName: string };

async function getOrCreateCustomer(stripe: StripeClient, user: UserInfo) {
  const list = await stripe.customers.list({ email: user.email, limit: 1 });
  if (list.data.length > 0) return list.data[0];
  return stripe.customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    metadata: { userId: user.id },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  user: UserInfo,
  plan: Plan,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const stripe = getStripe();
  const customer = await getOrCreateCustomer(stripe, user);

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.id,
    metadata: { userId: user.id, plan },
    subscription_data: { metadata: { userId: user.id, plan } },
  });

  return session.url!;
}

export async function createPortalSession(user: UserInfo, returnUrl: string): Promise<string> {
  const stripe = getStripe();
  const customer = await getOrCreateCustomer(stripe, user);
  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: returnUrl,
  });
  return session.url;
}

export async function handleWebhookEvent(payload: Buffer, sig: string): Promise<void> {
  const stripe = getStripe();
  if (!env.STRIPE_WEBHOOK_SECRET) throw new Error('Missing STRIPE_WEBHOOK_SECRET');

  const event = stripe.webhooks.constructEvent(payload, sig, env.STRIPE_WEBHOOK_SECRET);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = event.data.object as any;

  switch (event.type) {
    case 'checkout.session.completed': {
      const userId: string | undefined = obj.metadata?.userId;
      const plan = obj.metadata?.plan as Plan | undefined;
      if (userId && plan) await setPlan(userId, plan);
      break;
    }

    case 'customer.subscription.updated': {
      const priceId: string | undefined = obj.items?.data?.[0]?.price?.id;
      const plan = priceId ? planForPriceId(priceId) : undefined;
      if (!plan) break;
      const customer = await stripe.customers.retrieve(obj.customer as string) as { metadata?: { userId?: string } };
      const userId = customer.metadata?.userId;
      if (userId) await setPlan(userId, plan);
      break;
    }

    case 'customer.subscription.deleted': {
      const customer = await stripe.customers.retrieve(obj.customer as string) as { metadata?: { userId?: string } };
      const userId = customer.metadata?.userId;
      if (userId) await setPlan(userId, 'ESSENTIALS');
      break;
    }

    default:
      break;
  }
}
