export type AddonKey = 'valence_copilot';

export interface AddonDef {
  key: AddonKey;
  name: string;
  price: number;
  blurb: string;
  features: string[];
}

export const ADDONS: Record<AddonKey, AddonDef> = {
  valence_copilot: {
    key: 'valence_copilot',
    name: 'Valence Copilot',
    price: 49,
    blurb: 'Your portfolio analyst — reads your Finance data, explains what it means, and points you to the work. Built on the deterministic engine; it never replaces the numbers.',
    features: [
      'Executive Brief — a written read of your portfolio state',
      'Ask Valence — natural-language questions across your Finance data',
      'Cross-portfolio insights beyond the deterministic rules',
      'Narrative explanations for forecasts and scenarios',
    ],
  },
};

export const ADDON_KEYS = Object.keys(ADDONS) as AddonKey[];

export const VALENCE_COPILOT: AddonKey = 'valence_copilot';

export function isAddonKey(value: string): value is AddonKey {
  return (ADDON_KEYS as string[]).includes(value);
}
