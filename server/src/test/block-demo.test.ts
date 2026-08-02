import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { blockDemo } from '../middleware/blockDemo';

/**
 * The demo account (#248) must never be able to touch protected resources —
 * organization settings, billing, user management, integrations,
 * authentication settings, security config — regardless of what the client
 * sends. blockDemo is the single enforcement point wired onto every one of
 * those routes; authenticate() re-checks isDemo against the DB on every
 * request, so this middleware trusts req.user.isDemo without a query of
 * its own.
 */

function mockReq(user?: Partial<Express.Request['user']>): Request {
  return { user } as unknown as Request;
}

describe('blockDemo', () => {
  it('rejects a demo account with a clear, user-facing message', () => {
    const next = vi.fn();
    blockDemo(mockReq({ isDemo: true } as never), {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as Error;
    expect(err.message).toBe('This action is not available in the demo portfolio.');
  });

  it('lets a real account through untouched', () => {
    const next = vi.fn();
    blockDemo(mockReq({ isDemo: false } as never), {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });

  it('requires authentication before it can even evaluate isDemo', () => {
    const next = vi.fn();
    blockDemo(mockReq(undefined), {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as Error;
    expect(err.message).toMatch(/unauthorized/i);
  });
});
