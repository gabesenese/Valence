/**
 * Client feature flags. Finance Copilot is under active development and is NOT
 * released: it ships hidden. The flag is only ever set to 'true' in a local
 * `.env` (gitignored), so production builds — which have no such env var —
 * resolve it to false and never render the Copilot surfaces or sell the add-on.
 */
export const FINANCE_COPILOT_ENABLED = import.meta.env.VITE_FEATURE_FINANCE_COPILOT === 'true';
