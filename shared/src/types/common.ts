export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'VIEWER';

export type RenewalRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AlertStatus = 'OPEN' | 'IN_PROGRESS' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED' | 'DISMISSED';

export type RenewalStage =
  | 'NOT_STARTED'
  | 'CONTACTED'
  | 'NEGOTIATING'
  | 'DRAFT_SENT'
  | 'LEGAL_REVIEW'
  | 'SCHEDULED_RENEWAL'
  | 'SIGNED';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface LeaseActivityDTO {
  id: string;
  leaseId: string;
  actorUserId: string | null;
  actor: { id: string; firstName: string; lastName: string } | null;
  actionType: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface LeaseNoteDTO {
  id: string;
  leaseId: string;
  authorUserId: string | null;
  author: { id: string; firstName: string; lastName: string } | null;
  body: string;
  createdAt: string;
}
