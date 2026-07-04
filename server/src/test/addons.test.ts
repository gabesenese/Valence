import { describe, it, expect } from 'vitest';
import { ADDON_KEYS as SHARED_ADDON_KEYS } from '@valence/shared';
import { ADDON_KEYS as SERVER_ADDON_KEYS } from '../modules/plans/addons';

describe('add-on keys stay in sync with the shared registry', () => {
  it('server add-on keys equal the shared registry the pricing page renders', () => {
    expect([...SERVER_ADDON_KEYS].sort()).toEqual([...SHARED_ADDON_KEYS].sort());
  });
});
