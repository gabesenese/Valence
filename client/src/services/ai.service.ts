import { api, extractData } from './api';

// ─── Executive brief ──────────────────────────────────────────────────────────

export interface RiskItem {
  title:          string;
  description:    string;
  severity:       'critical' | 'high' | 'medium';
  monthlyRevenue?: number;
  leaseNumber?:   string;
  tenantName?:    string;
  daysRemaining?: number;
}

export interface ActionItem {
  action:      string;
  context:     string;
  urgency:     'immediate' | 'this_week' | 'this_month';
  category:    'contact_tenant' | 'start_renewal' | 'send_document' | 'financial_review' | 'investigate';
  entityName?: string;
  leaseNumber?: string;
}

export interface ExecutiveBrief {
  generatedAt:     string;
  portfolioHealth: 'critical' | 'at_risk' | 'stable' | 'healthy';
  headline:        string;
  summary:         string;
  revenueRisk:     RiskItem[];
  actions:         ActionItem[];
}

// ─── Extracted lease ──────────────────────────────────────────────────────────

export interface ExtractedLease {
  tenantName:      string | null;
  propertyAddress: string | null;
  unitNumber:      string | null;
  startDate:       string | null;
  endDate:         string | null;
  baseRent:        number | null;
  rentEscalation:  number | null;
  securityDeposit: number | null;
  sqft:            number | null;
  leaseType:       'GROSS' | 'NET' | 'MODIFIED_GROSS' | 'PERCENTAGE' | 'GROUND' | null;
  renewalOptions:  string | null;
  obligations:     string | null;
  notes:           string | null;
}

export const aiService = {
  getExecutiveBrief: (): Promise<ExecutiveBrief> =>
    api.get('/ai/executive-brief', { timeout: 120_000 }).then(extractData<ExecutiveBrief>),

  extractLease: (file: File): Promise<ExtractedLease> => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post('/ai/extract-lease', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 })
      .then(extractData<ExtractedLease>);
  },
};
