import { describe, it, expect, beforeEach, vi } from 'vitest';

const { postMock, setTokens } = vi.hoisted(() => ({ postMock: vi.fn(), setTokens: vi.fn() }));

vi.mock('axios', () => {
  const instance = {
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: {},
  };
  return { default: { create: () => instance, post: postMock } };
});

vi.mock('@/state/auth.store', () => ({
  useAuthStore: { getState: () => ({ refreshToken: 'stored-refresh', setTokens }) },
}));

import { getFreshAccessToken } from './api';

describe('getFreshAccessToken single-flight', () => {
  beforeEach(() => {
    postMock.mockReset();
    setTokens.mockReset();
    postMock.mockResolvedValue({ data: { data: { tokens: { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' } } } });
  });

  it('collapses concurrent refreshes into a single /auth/refresh call', async () => {
    const results = await Promise.all([getFreshAccessToken(), getFreshAccessToken(), getFreshAccessToken(), getFreshAccessToken()]);
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['fresh-access', 'fresh-access', 'fresh-access', 'fresh-access']);
    expect(setTokens).toHaveBeenCalledWith('fresh-access', 'fresh-refresh');
  });

  it('allows a new refresh after the in-flight one settles', async () => {
    await getFreshAccessToken();
    await getFreshAccessToken();
    expect(postMock).toHaveBeenCalledTimes(2);
  });
});
