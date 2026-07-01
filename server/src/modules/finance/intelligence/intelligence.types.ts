export type Direction = 'up' | 'down' | 'flat';
export type Sentiment = 'good' | 'bad' | 'neutral';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';
export type Band = 'HEALTHY' | 'WATCH' | 'AT_RISK';

export interface Confidence {
  level: ConfidenceLevel;
  basis: string;
}

export type ImpactUnit = 'PER_MONTH' | 'ONCE' | 'PERCENT';

export interface Impact {
  value: number;
  unit: ImpactUnit;
}

export interface MetricDelta {
  key: 'revenue' | 'expenses' | 'netIncome';
  label: string;
  current: number;
  previous: number;
  deltaAbs: number;
  deltaPct: number | null;
  direction: Direction;
  sentiment: Sentiment;
  // False when the current month is too incomplete to compare honestly (e.g. expenses
  // not entered yet) — the UI then shows no delta and health ignores it.
  comparable: boolean;
  confidence: Confidence;
}

export interface Highlight {
  key: string;
  kind: 'REVENUE_AT_RISK' | 'OVER_BUDGET' | 'OVERDUE_RENT';
  count: number;
  amount: number | null;
  detail: string | null;
  tone: 'info' | 'warning' | 'critical';
  deepLink: string | null;
}

export interface HealthFactor {
  key: string;
  label: string;
  direction: Direction;
  sentiment: Sentiment;
  status: 'ok' | 'warn' | 'bad';
}

export interface HealthScore {
  score: number;
  band: Band;
  factors: HealthFactor[];
  reasons: string[];
  confidence: Confidence;
}

export interface ChangeItem {
  key: string;
  label: string;
  amount: number | null;
  count: number | null;
  direction: Direction;
  sentiment: Sentiment;
}

export type RecommendationAction =
  | 'RENEW_LEASE'
  | 'REVIEW_BUDGET'
  | 'COLLECT'
  | 'SET_LATE_FEE_POLICY';

export interface Recommendation {
  id: string;
  priority: number;
  title: string;
  description: string;
  impact: Impact | null;
  severity: Severity;
  action: RecommendationAction;
  deepLink: string;
  confidence: Confidence;
}

export interface FinancialIntelligence {
  generatedAt: string;
  metrics: MetricDelta[];
  highlights: Highlight[];
  health: HealthScore;
  sinceLastVisit: ChangeItem[];
  recommendations: Recommendation[];
}
