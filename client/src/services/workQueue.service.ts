import { api, extractData } from './api';

export type WorkItemSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type WorkItemStatus = 'OPEN' | 'IN_PROGRESS';
export type WorkItemSource = 'alert' | 'lease' | 'finance';

export interface WorkItem {
  id: string;
  source: WorkItemSource;
  alertId: string | null;
  leaseId: string | null;
  financialRecordId: string | null;
  type: string;
  severity: WorkItemSeverity;
  status: WorkItemStatus;
  title: string;
  description: string;
  suggestedAction: string;
  priorityScore: number;
  monthlyRisk: number;
  daysUntilExpiry: number | null;
  property: { id: string; name: string; code: string } | null;
  lease: { id: string; leaseNumber: string; tenantName: string; baseRent: number } | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface WorkQueueSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  inProgress: number;
}

export interface WorkQueueResult {
  items: WorkItem[];
  summary: WorkQueueSummary;
}

export const workQueueService = {
  getQueue: (myWork = false): Promise<WorkQueueResult> =>
    api.get('/work-queue', { params: { myWork } }).then(extractData<WorkQueueResult>),
};
