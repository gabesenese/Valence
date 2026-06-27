import type { Plan } from '@prisma/client';

// ─── Connector framework ────────────────────────────────────────────────────
// Every external integration (PM, accounting, CRM, storage) implements the same
// Connector lifecycle so adding a provider is mechanical, not a redesign. The
// concrete providers (Buildium, QuickBooks, …) register into connectorRegistry.

export type ConnectorCategory = 'property_management' | 'accounting' | 'crm' | 'storage';
export type AuthType = 'oauth2' | 'api_key';

export const CONNECTOR_CATEGORY_LABEL: Record<ConnectorCategory, string> = {
  property_management: 'Property Management',
  accounting:          'Accounting',
  crm:                 'CRM',
  storage:             'Storage',
};

// Catalog metadata — what the Integrations page renders, grouped by category.
export interface ConnectorInfo {
  id:          string;
  name:        string;
  description: string;
  category:    ConnectorCategory;
  authType:    AuthType;
  status:      'available' | 'planned';
}

// Per-entity counts from a sync — generic so any category fits (PM: properties/
// leases/tenants/payments; accounting: expenses/categories; etc.).
export interface SyncSummary {
  entities: Record<string, { created: number; updated: number; skipped: number }>;
  errors:   { entity?: string; message: string }[];
}

export type ConnectInput =
  | { type: 'api_key';    credentials: Record<string, string> }
  | { type: 'oauth_code'; code: string; redirectUri: string; params?: Record<string, string> };

// The uniform lifecycle every provider implements. connect() validates/exchanges
// credentials and returns the (provider-specific) config blob to persist on the
// Integration record — the service owns persistence + connection status.
export interface Connector {
  readonly info: ConnectorInfo;
  getAuthUrl?(ownerId: string, state: string, redirectUri: string): string;
  connect(ownerId: string, input: ConnectInput): Promise<Record<string, unknown>>;
  sync(ownerId: string): Promise<SyncSummary>;
  disconnect?(ownerId: string): Promise<void>;
}

// ─── Catalog ────────────────────────────────────────────────────────────────
export const CONNECTORS: ConnectorInfo[] = [
  { id: 'buildium',     name: 'Buildium',          description: 'Property management for residential portfolios.',  category: 'property_management', authType: 'api_key', status: 'planned' },
  { id: 'appfolio',     name: 'AppFolio',          description: 'Residential & commercial property management.',    category: 'property_management', authType: 'oauth2',  status: 'planned' },
  { id: 'rent_manager', name: 'Rent Manager',      description: 'All-in-one property management software.',         category: 'property_management', authType: 'api_key', status: 'planned' },
  { id: 'yardi',        name: 'Yardi',             description: 'Enterprise real estate & investment management.',  category: 'property_management', authType: 'api_key', status: 'planned' },
  { id: 'mri',          name: 'MRI Software',      description: 'Real estate & investment management suite.',       category: 'property_management', authType: 'api_key', status: 'planned' },
  { id: 'quickbooks',   name: 'QuickBooks Online', description: 'Sync operating expenses, bills, and categories.',  category: 'accounting',          authType: 'oauth2',  status: 'planned' },
  { id: 'xero',         name: 'Xero',              description: 'Cloud accounting for expenses and bills.',         category: 'accounting',          authType: 'oauth2',  status: 'planned' },
];

// Concrete providers register here as they are built (empty until Phase 1+).
export const connectorRegistry: Record<string, Connector> = {};

export function isKnownConnector(id: string): boolean {
  return CONNECTORS.some((c) => c.id === id);
}

export function getConnectorInfo(id: string): ConnectorInfo | undefined {
  return CONNECTORS.find((c) => c.id === id);
}

export function getConnector(id: string): Connector | undefined {
  return connectorRegistry[id];
}

// ─── Plan gating ────────────────────────────────────────────────────────────
// Standard API connectors are a Professional-tier feature (Essentials gets
// CSV/Excel import). Capturing interest in a planned connector stays open to all.
const PLAN_RANK: Record<Plan, number> = { FREE: 0, ESSENTIALS: 1, PROFESSIONAL: 2, EXECUTIVE: 3 };
export const INTEGRATIONS_MIN_PLAN: Plan = 'PROFESSIONAL';

export function planAllowsIntegrations(plan: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[INTEGRATIONS_MIN_PLAN];
}
