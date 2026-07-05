import { api, extractData } from './api';

export interface EvidenceRef {
  factId: string;
  label: string;
  value: string;
  source: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CopilotAction {
  label: string;
  deepLink: string;
}

export interface CopilotConfidence {
  level: 'COMPLETE' | 'PARTIAL';
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

export const copilotService = {
  getBrief: (): Promise<CopilotResponse> =>
    api.get('/ai/copilot/brief', { timeout: 60_000 }).then(extractData<CopilotResponse>),

  ask: (question: string): Promise<CopilotResponse> =>
    api.post('/ai/copilot/ask', { question }, { timeout: 60_000 }).then(extractData<CopilotResponse>),

  getObservations: (): Promise<CopilotObservations> =>
    api.get('/ai/copilot/observations', { timeout: 60_000 }).then(extractData<CopilotObservations>),
};
