import { api, extractData } from './api';

export interface ChangeGroup {
  kind: 'risk' | 'tasks' | 'revenue' | 'alerts';
  pill: string;
  title: string;
  detail?: string;
}

export interface ChangesSummary {
  asOf: string;
  firstVisit: boolean;
  total: number;
  groups: ChangeGroup[];
}

export const changesService = {
  getSince: (): Promise<ChangesSummary> =>
    api.get('/changes/since').then(extractData<ChangesSummary>),

  markSeen: (asOf: string): Promise<void> =>
    api.post('/changes/seen', { asOf }).then(() => undefined),
};
