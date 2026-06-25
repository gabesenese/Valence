import { api, extractData, extractPaginated, type PaginatedResult } from './api';

export type PropertyType = 'RESIDENTIAL' | 'COMMERCIAL' | 'MIXED_USE' | 'INDUSTRIAL' | 'RETAIL' | 'OFFICE';
export type PropertyStatus = 'ACTIVE' | 'INACTIVE' | 'UNDER_RENOVATION' | 'DISPOSED';

export interface Property {
  id: string;
  name: string;
  code: string;
  type: PropertyType;
  status: PropertyStatus;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  totalUnits: number;
  totalSqft: number;
  yearBuilt?: number;
  purchasePrice?: number;
  currentValue?: number;
  _count: { leases: number };
}

export interface PropertyDetail extends Property {
  country: string;
  purchaseDate?: string;
  _count: { leases: number; alerts: number };
  leases: Array<{
    id: string;
    leaseNumber: string;
    unitNumber?: string;
    status: string;
    renewalRisk: string;
    baseRent: number;
    endDate: string;
    tenant: { id: string; name: string; email?: string };
  }>;
}

export interface PropertyQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: PropertyStatus;
  type?: PropertyType;
  vacant?: boolean;
}

export interface CreatePropertyInput {
  name: string;
  code: string;
  type: PropertyType;
  status?: PropertyStatus;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  totalUnits: number;
  totalSqft: number;
  yearBuilt?: number;
  purchasePrice?: number;
  currentValue?: number;
}

export type UpdatePropertyInput = Partial<CreatePropertyInput>;

export interface PropertyActivityEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  entityName: string | null;
  changes: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string } | null;
}

export const propertiesService = {
  getProperties: (query: PropertyQuery = {}): Promise<PaginatedResult<Property>> =>
    api.get('/properties', { params: { limit: 50, ...query } }).then(extractPaginated<Property>),

  getProperty: (id: string): Promise<PropertyDetail> =>
    api.get(`/properties/${id}`).then(extractData<PropertyDetail>),

  getActivity: (id: string): Promise<PropertyActivityEntry[]> =>
    api.get(`/properties/${id}/activity`).then(extractData<PropertyActivityEntry[]>),

  createProperty: (input: CreatePropertyInput): Promise<PropertyDetail> =>
    api.post('/properties', input).then(extractData<PropertyDetail>),

  updateProperty: (id: string, input: UpdatePropertyInput): Promise<PropertyDetail> =>
    api.patch(`/properties/${id}`, input).then(extractData<PropertyDetail>),

  deleteProperty: (id: string): Promise<void> =>
    api.delete(`/properties/${id}`).then(() => undefined),
};
