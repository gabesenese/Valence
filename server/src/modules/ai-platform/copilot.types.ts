import type { ConfidenceLevel } from '../finance/intelligence/intelligence.types';

export type CopilotConfidenceLevel = 'COMPLETE' | 'PARTIAL';

export interface EvidenceRef {
  factId: string;
  label: string;
  value: string;
  source: string;
  confidence: ConfidenceLevel;
}

export interface CopilotAction {
  label: string;
  deepLink: string;
}

export interface CopilotConfidence {
  level: CopilotConfidenceLevel;
  limitations?: string[];
}

export interface CopilotResponse {
  answer: string;
  evidence: EvidenceRef[];
  actions: CopilotAction[];
  confidence: CopilotConfidence;
  generatedAt: string;
  degraded: boolean;
}

export interface ContextFact {
  factId: string;
  label: string;
  value: string;
  numeric: number | null;
  source: string;
  confidence: ConfidenceLevel;
  deepLink: string | null;
}

export interface FinanceContext {
  generatedAt: string;
  healthScore: number;
  healthBand: string;
  facts: ContextFact[];
  tenants: ContextFact[];
}

export type ObservationSeverity = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface CopilotObservation {
  id: string;
  title: string;
  detail: string;
  severity: ObservationSeverity;
  evidence: EvidenceRef[];
  action: CopilotAction | null;
}

export interface CopilotObservations {
  observations: CopilotObservation[];
  generatedAt: string;
}
