import { api } from './api';

export type SupportCategory = 'General Support' | 'Bug Report' | 'Feature Request';

export interface SupportTicket {
  category:    SupportCategory;
  subject:     string;
  message:     string;
  screenshot?: string | null;
  pageUrl:     string;
  browserInfo: string;
}

function extractData<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

export const supportService = {
  submitTicket: (ticket: SupportTicket) =>
    api.post('/support/ticket', ticket).then(extractData<{ sent: boolean }>),
};
