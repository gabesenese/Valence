export interface InsightContext {
  type: 'lease' | 'finance' | 'property' | 'portfolio';
  data: Record<string, unknown>;
}

export interface GeneratedInsight {
  title: string;
  summary: string;
  body: Record<string, unknown>;
  confidence: number;
  category: 'FINANCIAL' | 'OPERATIONAL' | 'LEASE' | 'RISK' | 'FORECAST';
}

export interface RiskEvaluation {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: string[];
  recommendation: string;
}

export interface AnomalyDetectionResult {
  detected: boolean;
  anomalies: Array<{
    field: string;
    expected: number;
    actual: number;
    deviation: number;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export interface AIProvider {
  generateInsight(context: InsightContext): Promise<GeneratedInsight>;
  evaluateRisk(context: InsightContext): Promise<RiskEvaluation>;
  detectAnomalies(timeSeries: number[]): Promise<AnomalyDetectionResult>;
}

export interface InsightEngine {
  analyzePortfolio(): Promise<GeneratedInsight[]>;
  analyzeProperty(propertyId: string): Promise<GeneratedInsight[]>;
  analyzeLease(leaseId: string): Promise<GeneratedInsight[]>;
}

export interface RiskEvaluator {
  evaluateLeaseRisk(leaseId: string): Promise<RiskEvaluation>;
  evaluatePortfolioRisk(): Promise<RiskEvaluation>;
}
