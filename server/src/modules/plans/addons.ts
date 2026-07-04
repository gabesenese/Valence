/**
 * Server-local mirror of the add-on keys. The canonical registry (with pricing
 * and marketing copy) lives in `@valence/shared` (addons.ts); it can't be imported
 * into server source because it sits outside the server's rootDir. A drift-guard
 * test (addons.test.ts) asserts these keys stay in sync with the shared registry.
 */
export type AddonKey = 'valence_copilot';

export const VALENCE_COPILOT: AddonKey = 'valence_copilot';

export const ADDON_KEYS: readonly AddonKey[] = ['valence_copilot'];

export function isAddonKey(value: string): value is AddonKey {
  return (ADDON_KEYS as readonly string[]).includes(value);
}
