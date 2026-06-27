import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { env } from '../../config/env';
import { encryptSecret, decryptSecret } from './security';
import type { Connector, ConnectInput, SyncSummary } from './connector';

const AUTH_BASE = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const apiBase = () =>
  env.QBO_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

interface QboConfig {
  accessToken: string;  // encrypted
  refreshToken: string; // encrypted
  realmId: string;
  expiresAt: string;
}

function basicAuth(): string {
  return Buffer.from(`${env.QBO_CLIENT_ID}:${env.QBO_CLIENT_SECRET}`).toString('base64');
}

async function exchangeToken(body: Record<string, string>): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`QuickBooks token exchange failed (${res.status})`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

class QuickBooksConnector implements Connector {
  readonly info = {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Sync operating expenses, bills, and categories.',
    category: 'accounting' as const,
    authType: 'oauth2' as const,
    status: 'available' as const,
  };

  getAuthUrl(_ownerId: string, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: env.QBO_CLIENT_ID ?? '',
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: redirectUri,
      state,
    });
    return `${AUTH_BASE}?${params.toString()}`;
  }

  async connect(_ownerId: string, input: ConnectInput): Promise<Record<string, unknown>> {
    if (input.type !== 'oauth_code') throw new Error('QuickBooks uses OAuth.');
    const realmId = input.params?.realmId;
    if (!realmId) throw new Error('QuickBooks callback is missing the company (realmId).');
    const tok = await exchangeToken({ grant_type: 'authorization_code', code: input.code, redirect_uri: input.redirectUri });
    const config: QboConfig = {
      accessToken: encryptSecret(tok.access_token),
      refreshToken: encryptSecret(tok.refresh_token),
      realmId,
      expiresAt: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
    };
    return config as unknown as Record<string, unknown>;
  }

  async sync(ownerId: string): Promise<SyncSummary> {
    const { accessToken, realmId } = await this.validAccessToken(ownerId);
    // PR1: validate the authenticated pipeline against CompanyInfo. PR2 pulls
    // Purchases/Bills into FinancialRecords with category + property mapping.
    const res = await fetch(`${apiBase()}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=70`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`QuickBooks API error (${res.status})`);
    return { entities: {}, errors: [] };
  }

  // Returns a usable access token, refreshing + persisting if the current one is near expiry.
  private async validAccessToken(ownerId: string): Promise<{ accessToken: string; realmId: string }> {
    const row = await prisma.integration.findUnique({ where: { ownerId_provider: { ownerId, provider: 'quickbooks' } } });
    const cfg = row?.config as unknown as QboConfig | undefined;
    if (!cfg?.refreshToken) throw new Error('QuickBooks is not connected.');

    const nearExpiry = new Date(cfg.expiresAt).getTime() - 60_000 < Date.now();
    if (!nearExpiry) return { accessToken: decryptSecret(cfg.accessToken), realmId: cfg.realmId };

    const tok = await exchangeToken({ grant_type: 'refresh_token', refresh_token: decryptSecret(cfg.refreshToken) });
    const next: QboConfig = {
      accessToken: encryptSecret(tok.access_token),
      refreshToken: encryptSecret(tok.refresh_token),
      realmId: cfg.realmId,
      expiresAt: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
    };
    await prisma.integration.update({
      where: { ownerId_provider: { ownerId, provider: 'quickbooks' } },
      data: { config: next as unknown as Prisma.InputJsonValue },
    });
    return { accessToken: tok.access_token, realmId: cfg.realmId };
  }
}

export const quickbooksConnector = new QuickBooksConnector();
