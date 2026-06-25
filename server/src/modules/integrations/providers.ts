// Catalog of property-management systems Valence can integrate with.
//
// Real sync implementations register themselves in `providerRegistry`. Until a
// provider has an implementation it is "planned" — users can register interest
// and the connect/sync routes degrade gracefully. To make a provider live:
//   1. implement `PmProvider`
//   2. add it to `providerRegistry` keyed by its id
//   3. flip its `status` to 'available' in `PM_PROVIDERS`

export interface PmSyncResult {
  properties: number;
  leases: number;
  tenants: number;
}

export interface PmProvider {
  readonly id: string;
  readonly name: string;
  /** Validate/exchange credentials for the connected account. */
  connect(config: Record<string, unknown>): Promise<{ ok: boolean }>;
  /** Pull data from the external system into Valence, scoped to one owner. */
  sync(ownerId: string): Promise<PmSyncResult>;
}

export interface PmProviderInfo {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'planned';
}

export const PM_PROVIDERS: PmProviderInfo[] = [
  { id: 'appfolio',     name: 'AppFolio',     description: 'Residential & commercial property management.', status: 'planned' },
  { id: 'buildium',     name: 'Buildium',     description: 'Property management for residential portfolios.', status: 'planned' },
  { id: 'yardi',        name: 'Yardi',        description: 'Enterprise real estate & investment management.', status: 'planned' },
  { id: 'rent_manager', name: 'Rent Manager', description: 'All-in-one property management software.',        status: 'planned' },
  { id: 'mri',          name: 'MRI Software', description: 'Real estate & investment management suite.',       status: 'planned' },
];

// Real provider implementations go here, keyed by provider id.
// e.g. providerRegistry.appfolio = new AppFolioProvider(env.APPFOLIO_CLIENT_ID, ...)
export const providerRegistry: Record<string, PmProvider> = {};

export function isKnownProvider(id: string): boolean {
  return PM_PROVIDERS.some((p) => p.id === id);
}

export function getProviderImpl(id: string): PmProvider | undefined {
  return providerRegistry[id];
}
