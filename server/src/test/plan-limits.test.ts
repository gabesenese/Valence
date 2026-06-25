import { describe, it, expect } from 'vitest';
import { PLAN_LIMITS as SHARED_LIMITS } from '@valence/shared';
import { PLAN_LIMITS as ENFORCED_LIMITS } from '../modules/plans/plans.service';

describe('plan limits stay in sync with the published pricing table', () => {
  it('server-enforced limits equal the shared limits the pricing page renders', () => {
    expect(ENFORCED_LIMITS).toEqual(SHARED_LIMITS);
  });
});
