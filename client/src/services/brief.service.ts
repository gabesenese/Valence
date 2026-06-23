import { api, extractData } from './api';

export interface BriefItem {
  kind: 'risk' | 'task' | 'alert';
  title: string;
  detail: string;
  severity?: string;
}

export interface DailyBrief {
  date: string;
  firstName: string;
  totalAtRisk: number;
  counts: { atRisk: number; dueTasks: number; newAlerts: number };
  atRisk: BriefItem[];
  dueTasks: BriefItem[];
  newAlerts: BriefItem[];
  isEmpty: boolean;
}

export const briefService = {
  getToday: (): Promise<DailyBrief> =>
    api.get('/brief/today').then(extractData<DailyBrief>),
};
