import { describe, it, expect } from 'vitest';
import { compactCurrency } from './format';

describe('compactCurrency', () => {
  it('renders sub-$1000 amounts as whole dollars — no ragged cents', () => {
    expect(compactCurrency(65.9, 'USD')).toBe('$66');
    expect(compactCurrency(992.95, 'USD')).toBe('$993');
    expect(compactCurrency(180.1, 'USD')).toBe('$180');
    expect(compactCurrency(246, 'USD')).toBe('$246');
  });

  it('never emits a decimal point below $1000', () => {
    for (const n of [0.4, 65.9, 180.1, 822.05, 992.95]) {
      expect(compactCurrency(n, 'USD')).not.toContain('.');
    }
  });

  it('compacts thousands and millions', () => {
    expect(compactCurrency(1_500, 'USD')).toBe('$2K');
    expect(compactCurrency(246_000, 'USD')).toBe('$246K');
    expect(compactCurrency(2_500_000, 'USD')).toBe('$2.5M');
  });
});
