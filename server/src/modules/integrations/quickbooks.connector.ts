import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { env } from '../../config/env';
import { encryptSecret, decryptSecret } from './security';
import { mapAccountNameToCategory } from '../finance/expense-categories';
import { resolveInternalId } from './external-ref.service';
import { loadAttributionContext, resolveProperty, materializeExpense, type ExpensePayload, type SourceTags } from './attribution.service';
import type { Connector, ConnectInput, SyncSummary } from './connector';

// Minimal shapes of the QBO entities we read.
interface QboRef { name?: string; value?: string }
interface QboLine {
  Id?: string;
  Amount?: number;
  DetailType?: string;
  Description?: string;
  AccountBasedExpenseLineDetail?: {
    AccountRef?: QboRef;
    ClassRef?: QboRef;
    CustomerRef?: QboRef;
  };
}
interface QboTxn {
  Id: string;
  TxnDate?: string;
  EntityRef?: QboRef;
  ClassRef?: QboRef;
  DepartmentRef?: QboRef;
  Line?: QboLine[];
}

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
    const ctx = await loadAttributionContext(ownerId, 'quickbooks');

    const summary: SyncSummary = { entities: { financial_record: { created: 0, updated: 0, skipped: 0, unmapped: 0 } }, errors: [] };
    const counts = summary.entities.financial_record;
    const unmappedTags = new Set<string>();

    for (const entity of ['Purchase', 'Bill'] as const) {
      const rows = await this.query(realmId, accessToken, `select * from ${entity} maxresults 1000`, entity);
      for (const txn of rows) {
        const lines = (txn.Line ?? []).filter((l) => l.DetailType === 'AccountBasedExpenseLineDetail');
        for (const line of lines) {
          const detail = line.AccountBasedExpenseLineDetail;
          const amount = Number(line.Amount ?? 0);
          if (!Number.isFinite(amount) || amount <= 0) { counts.skipped += 1; continue; }

          const externalId = `${entity}:${txn.Id}:${line.Id ?? '0'}`;
          const periodStart = txn.TxnDate ? new Date(txn.TxnDate) : new Date();
          const payload: ExpensePayload = {
            amount,
            periodStart: periodStart.toISOString(),
            category: mapAccountNameToCategory(detail?.AccountRef?.name),
            description: line.Description?.trim() || txn.EntityRef?.name?.trim() || `QuickBooks ${entity}`,
            source: 'quickbooks',
            entity,
            qboId: txn.Id,
          };
          const tags: SourceTags = {
            class: detail?.ClassRef?.name ?? txn.ClassRef?.name ?? null,
            location: txn.DepartmentRef?.name ?? null,
            customer: detail?.CustomerRef?.name ?? null,
          };

          // External ID: already imported → update its fields (keeps its property).
          const existingId = await resolveInternalId(ownerId, 'quickbooks', 'financial_record', externalId);
          if (existingId) {
            await prisma.financialRecord.update({
              where: { id: existingId },
              data: {
                amount: payload.amount,
                periodStart,
                periodEnd: periodStart,
                category: payload.category,
                description: payload.description,
              },
            });
            counts.updated += 1;
            continue;
          }

          const propertyId = resolveProperty(tags, ctx);
          if (propertyId) {
            await materializeExpense(ownerId, 'quickbooks', externalId, payload, propertyId);
            counts.created += 1;
          } else {
            // No confident property match → park in the Needs Mapping queue.
            await prisma.pendingSyncRecord.upsert({
              where:  { ownerId_provider_externalId: { ownerId, provider: 'quickbooks', externalId } },
              create: { ownerId, provider: 'quickbooks', entityType: 'financial_record', externalId, payload: payload as unknown as Prisma.InputJsonValue, sourceTags: tags as unknown as Prisma.InputJsonValue },
              update: { payload: payload as unknown as Prisma.InputJsonValue, sourceTags: tags as unknown as Prisma.InputJsonValue },
            });
            counts.unmapped += 1;
            for (const t of [tags.class, tags.location, tags.customer]) if (t) unmappedTags.add(t);
          }
        }
      }
    }

    if (counts.unmapped > 0) {
      const tagList = [...unmappedTags].slice(0, 5).join(', ');
      summary.errors.push({
        entity: 'financial_record',
        message: `${counts.unmapped} expense line(s) need property mapping${tagList ? ` (e.g. ${tagList})` : ' (no class/location/customer tag)'} — resolve them in the Mapping Center.`,
      });
    }
    return summary;
  }

  private async query(realmId: string, accessToken: string, query: string, entity: string): Promise<QboTxn[]> {
    const res = await fetch(`${apiBase()}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=70`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`QuickBooks ${entity} query failed (${res.status})`);
    const body = (await res.json()) as { QueryResponse?: Record<string, QboTxn[]> };
    return body.QueryResponse?.[entity] ?? [];
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
