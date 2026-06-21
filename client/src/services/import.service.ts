import { api } from './api';

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  currentCount?: number;
  planLimit?: number;
}

export interface CsvPreview {
  headers: string[];
  sample: Record<string, string>; // header → first data row value
}

export async function parseCsvPreview(file: File): Promise<CsvPreview> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? '';
      const lines = text.split(/\r?\n/);
      const headerLine = (lines[0] ?? '').replace(/^﻿/, ''); // strip BOM
      const dataLine   = lines[1] ?? '';

      const parseLine = (line: string): string[] => {
        const out: string[] = [];
        let cur = '', inQ = false;
        for (const ch of line) {
          if (ch === '"') { inQ = !inQ; }
          else if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        out.push(cur.trim());
        return out;
      };

      const headers = parseLine(headerLine).filter(Boolean);
      const values  = parseLine(dataLine);
      const sample: Record<string, string> = {};
      headers.forEach((h, i) => { sample[h] = values[i] ?? ''; });
      resolve({ headers, sample });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function postCsv(endpoint: string, file: File, columnMap?: Record<string, string>, defaults?: Record<string, string>): Promise<ImportResult> {
  const form = new FormData();
  form.append('csv', file);
  if (columnMap && Object.keys(columnMap).length) form.append('columnMap', JSON.stringify(columnMap));
  if (defaults && Object.keys(defaults).length)   form.append('defaults',  JSON.stringify(defaults));
  const res = await api.post(endpoint, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (res.data as { data: ImportResult }).data;
}

export const importService = {
  properties: (file: File, columnMap?: Record<string, string>, defaults?: Record<string, string>) => postCsv('/import/properties', file, columnMap, defaults),
  tenants:    (file: File, columnMap?: Record<string, string>, defaults?: Record<string, string>) => postCsv('/import/tenants',    file, columnMap, defaults),
  leases:     (file: File, columnMap?: Record<string, string>, defaults?: Record<string, string>) => postCsv('/import/leases',     file, columnMap, defaults),
};


export const TEMPLATES = {
  properties: {
    filename: 'properties_template.csv',
    content: [
      'name,code,type,address,city,state,zipCode,totalUnits,totalSqft,yearBuilt,purchasePrice,currentValue',
      'Sunset Apartments,SUNSET01,RESIDENTIAL,123 Main St,Toronto,ON,M5V 3A8,24,18000,2005,4500000,5200000',
      'Downtown Office,DOWNTOWN1,COMMERCIAL,456 Commerce Ave,Vancouver,BC,V6B 1A1,1,12500,1998,3200000,3800000',
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
