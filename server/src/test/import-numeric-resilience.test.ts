import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Spreadsheet-exported CSVs routinely format numbers with thousands separators
 * ("$54,300.00"), accounting-style negatives ("(500.00)"), or plain garbage
 * ("N/A"). Before this fix, parseFloat("54,300") silently returned 54 — the
 * wrong rent, with no error — instead of failing loudly. These tests prove
 * malformed numeric/date input either parses correctly or surfaces a clear,
 * row-level error, and never silently corrupts financial data.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    property: {
      count: vi.fn(() => Promise.resolve(0)),
      findFirst: vi.fn(() => Promise.resolve(null)),
      create: vi.fn((args: { data: unknown }) => Promise.resolve({ id: 'prop-1', ...args.data as object })),
      update: vi.fn(() => Promise.resolve({})),
    },
    lease: {
      count: vi.fn(() => Promise.resolve(0)),
      findUnique: vi.fn(() => Promise.resolve(null)),
      create: vi.fn((args: { data: unknown }) => Promise.resolve({ id: 'lease-1', ...args.data as object })),
    },
    tenant: {
      findFirst: vi.fn(() => Promise.resolve(null)),
      create: vi.fn((args: { data: unknown }) => Promise.resolve({ id: 'tenant-1', ...args.data as object })),
    },
    financialRecord: {
      create: vi.fn((args: { data: unknown }) => Promise.resolve({ id: 'fr-1', ...args.data as object })),
    },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));
vi.mock('../modules/finance/revenue-schedule.service', () => ({
  syncLeaseRevenueSchedule: vi.fn(() => Promise.resolve(0)),
}));
vi.mock('../modules/leases/leases.service', () => ({
  computeRenewalRisk: vi.fn(() => 'LOW'),
  logActivity: vi.fn(() => Promise.resolve()),
}));
vi.mock('../security/field-encryption', () => ({
  encryptNumber: vi.fn((v: number | null) => (v == null ? null : `enc:${v}`)),
}));

import { importProperties, importLeases, importExpenses } from '../modules/import/import.service';

const csv = (rows: string[]) => Buffer.from(rows.join('\n'), 'utf8');

beforeEach(() => vi.clearAllMocks());

describe('importProperties — malformed numeric input', () => {
  it('parses thousands-separated totalSqft and purchasePrice instead of truncating at the comma', async () => {
    const buf = csv([
      'name,code,type,address,city,state,zipCode,totalUnits,totalSqft,purchasePrice',
      'Test Tower,TT1,RESIDENTIAL,123 Main St,Toronto,ON,M1M1M1,10,"12,500","2,500,000"',
    ]);
    const result = await importProperties(buf, 'ESSENTIALS', 'user-1');
    expect(result.errors).toEqual([]);
    expect(result.created).toBe(1);
    const data = prismaMock.property.create.mock.calls[0][0].data as { totalSqft: number; purchasePrice: number };
    expect(data.totalSqft).toBe(12_500);
    expect(data.purchasePrice).toBe(2_500_000);
  });

  it('rejects a non-numeric totalUnits with a clear message instead of an opaque Prisma error', async () => {
    const buf = csv([
      'name,code,type,address,city,state,zipCode,totalUnits',
      'Test Tower,TT1,RESIDENTIAL,123 Main St,Toronto,ON,M1M1M1,N/A',
    ]);
    const result = await importProperties(buf, 'ESSENTIALS', 'user-1');
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0].message).toMatch(/totalUnits must be a whole number/i);
    expect(prismaMock.property.create).not.toHaveBeenCalled();
  });

  it('rejects a zero totalUnits', async () => {
    const buf = csv([
      'name,code,type,address,city,state,zipCode,totalUnits',
      'Test Tower,TT1,RESIDENTIAL,123 Main St,Toronto,ON,M1M1M1,0',
    ]);
    const result = await importProperties(buf, 'ESSENTIALS', 'user-1');
    expect(result.errors[0].message).toMatch(/totalUnits must be greater than 0/i);
  });
});

describe('importLeases — malformed numeric input and date order', () => {
  beforeEach(() => {
    prismaMock.property.findFirst.mockResolvedValue({ id: 'prop-1', code: 'TT1' } as never);
  });

  it('parses a currency-symbol, thousands-separated baseRent correctly', async () => {
    const buf = csv([
      'propertyCode,tenantName,leaseNumber,startDate,endDate,baseRent',
      'TT1,John Doe,L100,2026-01-01,2027-01-01,"$54,300.00"',
    ]);
    const result = await importLeases(buf, 'ESSENTIALS', 'user-1');
    expect(result.errors).toEqual([]);
    expect(result.created).toBe(1);
    const data = prismaMock.lease.create.mock.calls[0][0].data as { baseRent: number };
    expect(data.baseRent).toBe(54_300);
  });

  it('rejects an endDate that is not after startDate', async () => {
    const buf = csv([
      'propertyCode,tenantName,leaseNumber,startDate,endDate,baseRent',
      'TT1,John Doe,L101,2027-01-01,2026-01-01,1000',
    ]);
    const result = await importLeases(buf, 'ESSENTIALS', 'user-1');
    expect(result.created).toBe(0);
    expect(result.errors[0].message).toMatch(/endDate .* must be after startDate/i);
    expect(prismaMock.lease.create).not.toHaveBeenCalled();
  });

  it('rejects a zero baseRent', async () => {
    const buf = csv([
      'propertyCode,tenantName,leaseNumber,startDate,endDate,baseRent',
      'TT1,John Doe,L102,2026-01-01,2027-01-01,0',
    ]);
    const result = await importLeases(buf, 'ESSENTIALS', 'user-1');
    expect(result.errors[0].message).toMatch(/baseRent must be greater than 0/i);
  });
});

describe('importExpenses — malformed numeric input', () => {
  beforeEach(() => {
    prismaMock.property.findFirst.mockResolvedValue({ id: 'prop-1', code: 'TT1' } as never);
  });

  it('parses a thousands-separated amount correctly', async () => {
    const buf = csv([
      'propertyCode,amount,date',
      'TT1,"1,250.00",2026-01-01',
    ]);
    const result = await importExpenses(buf, 'user-1');
    expect(result.errors).toEqual([]);
    expect(result.created).toBe(1);
    const data = prismaMock.financialRecord.create.mock.calls[0][0].data as { amount: number };
    expect(data.amount).toBe(1_250);
  });

  it('rejects a non-numeric amount with a clear message', async () => {
    const buf = csv([
      'propertyCode,amount,date',
      'TT1,abc,2026-01-01',
    ]);
    const result = await importExpenses(buf, 'user-1');
    expect(result.created).toBe(0);
    expect(result.errors[0].message).toMatch(/amount must be a valid number/i);
  });
});
