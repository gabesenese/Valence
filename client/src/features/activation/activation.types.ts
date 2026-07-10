export type FindingSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface ActivationFinding {
  severity: FindingSeverity;
  title: string;
  detail: string;
  value?: string;
}

/*
 * The result of "understanding" a portfolio — produced identically whether the
 * data arrived by import or by the demo loader. Every number is derived from
 * getFinanceIntelligence + the finance summary; nothing here is invented.
 */
export interface AnalysisResult {
  propertyCount: number;
  leaseCount: number;
  tenantCount: number;
  monthlyRevenue: number;
  annualRevenue: number;
  leaseRents: number[];
  opportunityCount: number;
  findings: ActivationFinding[];
  /* One directive drawn from the highest-priority finding — the first task. */
  directive: string | null;
  /* The action that directive resolves to, and where it lands. */
  directiveAction: string | null;
  directiveDeepLink: string | null;
  /* Money at stake behind the directive — 'annual' for revenue we'd protect,
   * 'once' for a one-time recovery. Null when the top item isn't dollar-framed. */
  directiveImpact: { amount: number; frame: 'annual' | 'once' } | null;
  /* Days until the portfolio's soonest lease expiry — the real horizon behind a
   * renewal directive. Null when nothing is expiring. */
  directiveHorizonDays: number | null;
}

/*
 * A single real step of the analysis. run() performs genuine work (a network
 * call or a real client-side derivation) and resolves with what it found. The
 * console paces to the real work — no fabricated timers — with only a small
 * legibility floor so a fast response doesn't flash past unread.
 */
export interface StepOutcome {
  value: string;
  bars?: { rents: number[]; annualRevenue: number };
}

export interface AnalysisStep {
  label: string;
  run: () => Promise<StepOutcome>;
}

export interface PortfolioAnalyzer {
  steps: AnalysisStep[];
  finalize: () => AnalysisResult;
}
