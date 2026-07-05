import { api } from './api';
import type { Plan } from '@/state/auth.store';

export const billingService = {
  createCheckout: (plan: Plan): Promise<string> =>
    api.post<{ data: { url: string } }>('/billing/checkout', { plan }).then((r) => r.data.data.url),

  createAddonCheckout: (addon: string): Promise<string> =>
    api.post<{ data: { url: string } }>('/billing/addon-checkout', { addon }).then((r) => r.data.data.url),

  createPortal: (): Promise<string> =>
    api.post<{ data: { url: string } }>('/billing/portal').then((r) => r.data.data.url),
};
