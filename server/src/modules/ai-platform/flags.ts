import { env } from '../../config/env';

/**
 * Internal feature flag for Finance Copilot. Lets us wire and test Copilot
 * endpoints before GA without exposing them. Gating for paying customers is the
 * add-on entitlement (addonGate); this flag is the kill-switch on top.
 */
export function isCopilotEnabled(): boolean {
  return env.FEATURE_FINANCE_COPILOT;
}
