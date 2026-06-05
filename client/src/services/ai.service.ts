import { api, extractData } from './api';

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
  extractLease: (file: File): Promise<ExtractedLease> => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post('/ai/extract-lease', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(extractData<ExtractedLease>);
  },
};
