import { api, extractData } from './api';

export type AutomationTrigger =
  | 'LEASE_DAYS_REMAINING'
  | 'PAYMENT_OVERDUE_DAYS'
  | 'OCCUPANCY_BELOW'
  | 'RISK_SCORE_ABOVE';

export type AutomationAction = 'CREATE_TASK' | 'NOTIFY_ASSIGNEE' | 'ESCALATE_ALERT';

export interface RuleConditions {
  daysRemaining?: number;
  overdueDays?: number;
  occupancyPct?: number;
  riskScore?: number;
}

export interface ActionConfig {
  taskTitle?: string;
  taskDescription?: string;
  assignTo?: string;
  daysUntilDue?: number;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  trigger: AutomationTrigger;
  conditions: RuleConditions;
  action: AutomationAction;
  actionConfig: ActionConfig;
  lastRunAt: string | null;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string } | null;
  _count: { logs: number };
}

export interface AutomationLog {
  id: string;
  outcome: string;
  tasksCreated: number;
  details: Record<string, unknown> | null;
  triggeredAt: string;
  rule: { id: string; name: string };
}

export const automationService = {
  getRules: () => api.get('/automation/rules').then(extractData<AutomationRule[]>),

  createRule: (data: {
    name: string;
    description?: string;
    trigger: AutomationTrigger;
    conditions: RuleConditions;
    action: AutomationAction;
    actionConfig: ActionConfig;
  }) => api.post('/automation/rules', data).then(extractData<AutomationRule>),

  updateRule: (
    id: string,
    data: { name?: string; description?: string; isActive?: boolean; conditions?: RuleConditions; actionConfig?: ActionConfig },
  ) => api.patch(`/automation/rules/${id}`, data).then(extractData<AutomationRule>),

  deleteRule: (id: string) =>
    api.delete(`/automation/rules/${id}`).then(extractData<{ deleted: boolean }>),

  runRule: (id: string) =>
    api
      .post(`/automation/rules/${id}/run`)
      .then(extractData<{ tasksCreated: number; details: Record<string, unknown> }>),

  getLogs: (ruleId?: string) =>
    api
      .get('/automation/logs', { params: ruleId ? { ruleId } : undefined })
      .then(extractData<AutomationLog[]>),
};
