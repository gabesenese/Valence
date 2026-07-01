import { api } from './api';

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  entityName: string | null;
  changes: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export const auditService = {
  list: (params?: { entity?: string; userId?: string; action?: string; page?: number; limit?: number }): Promise<AuditLogResponse> =>
    api.get('/audit', { params }).then((r) => r.data as AuditLogResponse),
};
