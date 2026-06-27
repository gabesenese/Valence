import { describe, it, expect } from 'vitest';
import { EXPENSE_CATEGORY_VALUES as SHARED } from '@valence/shared';
import { EXPENSE_CATEGORY_VALUES as SERVER } from '../modules/finance/expense-categories';

describe('expense categories stay in sync with the shared list', () => {
  it('server import validation accepts exactly the categories the client offers', () => {
    expect(SERVER).toEqual(SHARED);
  });
});
