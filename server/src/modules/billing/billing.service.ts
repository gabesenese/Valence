import Stripe from 'stripe';
import type { Plan } from '@prisma/client';
import { VALENCE_COPILOT, type AddonKey } from '../plans/addons';
import { env } from '../../config/env';
import { setPlan, getAddons, setAddons } from '../plans/plans.service';
import { trackEvent } from '../analytics/funnel.service';


function getStripe() {
  if (!env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY)');
  return new Stripe(env.STRIPE_SECRET_KEY);
}

type StripeClient = ReturnType<typeof getStripe>;


function priceIdForPlan(plan: Plan): string {
  const id: string | undefined = {
    FREE:         undefined,
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

function priceIdForAddon(addon: AddonKey): string {
  const id: string | undefined = { valence_copilot: env.STRIPE_PRICE_AI_COPILOT }[addon];
  if (!id) throw new Error(`No Stripe price configured for add-on: ${addon}`);
  return id;
}

function addonForPriceId(priceId: string): AddonKey | undefined {
  if (priceId === env.STRIPE_PRICE_AI_COPILOT) return VALENCE_COPILOT;
  return undefined;
}

/**
 * Reconcile a user's plan + add-ons from the price ids on a Stripe subscription.
 * `active` = subscription is live (add/upgrade); false = it was removed (downgrade to FREE / drop add-on).
 * Plan is only touched when a tier price is present, so an add-on-only subscription never resets the tier.
 */
async function applySubscriptionItems(userId: string, priceIds: string[], active: boolean): Promise<void> {
  const tier = priceIds.map(planForPriceId).find((p): p is Plan => Boolean(p));
  if (tier) await setPlan(userId, active ? tier : 'FREE');

  const addonsInSub = priceIds.map(addonForPriceId).filter((a): a is AddonKey => Boolean(a));
  if (addonsInSub.length > 0) {
    const current = await getAddons(userId);
    const next = active
      ? [...current, ...addonsInSub]
      : current.filter((a) => !addonsInSub.includes(a as AddonKey));
    await setAddons(userId, next);
  }
}


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


async function userIdForCustomer(stripe: StripeClient, customerId: string): Promise<string | undefined> {
  const customer = await stripe.customers.retrieve(customerId) as { metadata?: { userId?: string } };
  return customer.metadata?.userId;
}


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

export async function createAddonCheckout(
  user: UserInfo,
  addon: AddonKey,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const stripe = getStripe();
  const customer = await getOrCreateCustomer(stripe, user);

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceIdForAddon(addon), quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.id,
    metadata: { userId: user.id, addon },
    subscription_data: { metadata: { userId: user.id, addon } },
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
      const addon = obj.metadata?.addon as AddonKey | undefined;
      if (userId && plan) { await setPlan(userId, plan); void trackEvent('upgraded', userId, { plan }); }
      if (userId && addon) {
        const current = await getAddons(userId);
        await setAddons(userId, [...current, addon]);
        void trackEvent('addon_purchased', userId, { addon });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const priceIds: string[] = (obj.items?.data ?? [])
        .map((i: { price?: { id?: string } }) => i.price?.id)
        .filter((id: string | undefined): id is string => Boolean(id));
      const userId = await userIdForCustomer(stripe, obj.customer as string);
      if (userId) await applySubscriptionItems(userId, priceIds, true);
      break;
    }

    case 'customer.subscription.deleted': {
      const priceIds: string[] = (obj.items?.data ?? [])
        .map((i: { price?: { id?: string } }) => i.price?.id)
        .filter((id: string | undefined): id is string => Boolean(id));
      const userId = await userIdForCustomer(stripe, obj.customer as string);
      if (userId) await applySubscriptionItems(userId, priceIds, false);
      break;
    }

    default:
      break;
  }
}
