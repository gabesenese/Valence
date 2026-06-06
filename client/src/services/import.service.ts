import { api } from './api';

export interface ImportResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

async function postCsv(endpoint: string, file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append('csv', file);
  const res = await api.post(endpoint, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (res.data as { data: ImportResult }).data;
}

export const importService = {
  properties: (file: File) => postCsv('/import/properties', file),
  tenants:    (file: File) => postCsv('/import/tenants', file),
  leases:     (file: File) => postCsv('/import/leases', file),
};

// ─── CSV templates ────────────────────────────────────────────────────────────

export const TEMPLATES = {
  properties: {
    filename: 'properties_template.csv',
    content: [
      'name,code,type,address,city,state,zipCode,totalUnits,totalSqft,yearBuilt,purchasePrice,currentValue',
      'Sunset Apartments,SUNSET01,RESIDENTIAL,123 Main St,Austin,TX,78701,24,18000,2005,4500000,5200000',
      'Downtown Office,DOWNTOWN1,COMMERCIAL,456 Commerce Ave,Austin,TX,78702,1,12500,1998,3200000,3800000',
    ].join('\n'),
    hint: 'type: RESIDENTIAL · COMMERCIAL · MIXED_USE · INDUSTRIAL · RETAIL · OFFICE',
  },
  tenants: {
    filename: 'tenants_template.csv',
    content: [
      'name,email,phone,company,creditScore,notes',
      'Jane Smith,jane@example.com,512-555-0101,Acme Corp,720,Reliable payer',
      'John Doe,john@example.com,512-555-0102,,680,',
    ].join('\n'),
    hint: 'email must be unique; creditScore is optional (300–850)',
  },
  leases: {
    filename: 'leases_template.csv',
    content: [
      'propertyCode,tenantName,tenantEmail,leaseNumber,startDate,endDate,baseRent,type,unitNumber,rentEscalation,securityDeposit,sqft,notes',
      'SUNSET01,Jane Smith,jane@example.com,LSE-001,2024-01-01,2025-12-31,2800,GROSS,101,0.03,5600,950,',
      'DOWNTOWN1,Acme Corp,,LSE-002,2023-06-01,2026-05-31,12500,NET,,0.025,25000,12500,Triple net',
    ].join('\n'),
    hint: 'propertyCode must match an existing property; dates in YYYY-MM-DD; type: GROSS · NET · MODIFIED_GROSS · PERCENTAGE · GROUND',
  },
} as const;

export function downloadTemplate(key: keyof typeof TEMPLATES) {
  const { filename, content } = TEMPLATES[key];
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
