import { prisma } from '../../infrastructure/database';
import { extractLeaseFromPDF, type ExtractedLease } from './lease-extractor.service';

export type FieldStatus = 'match' | 'mismatch' | 'missing_in_document';

export interface LeaseFieldComparison {
  field: string;
  label: string;
  stored: string | null;
  extracted: string | null;
  status: FieldStatus;
}

export interface LeaseVerificationResult {
  leaseId: string;
  extracted: ExtractedLease;
  comparisons: LeaseFieldComparison[];
  matchCount: number;
  mismatchCount: number;
  missingCount: number;
}

const fmtMoney = (n: number | null): string | null => (n == null ? null : `$${Math.round(n).toLocaleString()}`);
const fmtPct = (n: number | null): string | null => (n == null ? null : `${Number(n.toFixed(2))}%`);
const fmtNum = (n: number | null): string | null => (n == null ? null : n.toLocaleString());
const fmtDate = (d: Date | null): string | null => (d == null ? null : d.toISOString().slice(0, 10));

const normStr = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const eqLoose = (a: string, b: string) => {
  const na = normStr(a), nb = normStr(b);
  return na === nb || na.includes(nb) || nb.includes(na);
};
const eqAlnum = (a: string, b: string) =>
  a.toLowerCase().replace(/[^a-z0-9]/g, '') === b.toLowerCase().replace(/[^a-z0-9]/g, '');

// Numbers match within a relative percentage or a small absolute floor — OCR/rounding tolerant.
const within = (relPct: number, absFloor: number) => (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(absFloor, (relPct / 100) * Math.max(Math.abs(a), Math.abs(b)));

function numStatus(stored: number | null, extracted: number | null, tol: (a: number, b: number) => boolean): FieldStatus {
  if (extracted == null) return 'missing_in_document';
  if (stored == null) return 'mismatch';
  return tol(stored, extracted) ? 'match' : 'mismatch';
}

function strStatus(stored: string | null, extracted: string | null, eq: (a: string, b: string) => boolean): FieldStatus {
  if (!extracted) return 'missing_in_document';
  if (!stored) return 'mismatch';
  return eq(stored, extracted) ? 'match' : 'mismatch';
}

export async function verifyLeaseDocument(
  leaseId: string,
  userId: string,
  pdfBuffer: Buffer,
): Promise<LeaseVerificationResult> {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, deletedAt: null, property: { ownerId: userId, deletedAt: null } },
    include: { tenant: true, property: true },
  });
  if (!lease) throw new Error('Lease not found');

  const extracted = await extractLeaseFromPDF(pdfBuffer);

  const storedRent = Number(lease.baseRent);
  const storedDeposit = lease.securityDeposit == null ? null : Number(lease.securityDeposit);
  const storedSqft = lease.sqft == null ? null : Number(lease.sqft);
  const storedEscalationPct = Number(lease.rentEscalation) * 100; // stored as a fraction

  const comparisons: LeaseFieldComparison[] = [
    {
      field: 'tenantName', label: 'Tenant',
      stored: lease.tenant.name, extracted: extracted.tenantName,
      status: strStatus(lease.tenant.name, extracted.tenantName, eqLoose),
    },
    {
      field: 'unitNumber', label: 'Unit',
      stored: lease.unitNumber ?? null, extracted: extracted.unitNumber,
      status: strStatus(lease.unitNumber ?? null, extracted.unitNumber, eqAlnum),
    },
    {
      field: 'startDate', label: 'Start date',
      stored: fmtDate(lease.startDate), extracted: extracted.startDate,
      status: strStatus(fmtDate(lease.startDate), extracted.startDate, (a, b) => a === b),
    },
    {
      field: 'endDate', label: 'End date',
      stored: fmtDate(lease.endDate), extracted: extracted.endDate,
      status: strStatus(fmtDate(lease.endDate), extracted.endDate, (a, b) => a === b),
    },
    {
      field: 'baseRent', label: 'Base rent',
      stored: fmtMoney(storedRent), extracted: fmtMoney(extracted.baseRent),
      status: numStatus(storedRent, extracted.baseRent, within(1, 1)),
    },
    {
      field: 'rentEscalation', label: 'Rent escalation',
      stored: fmtPct(storedEscalationPct), extracted: fmtPct(extracted.rentEscalation),
      status: numStatus(storedEscalationPct, extracted.rentEscalation, within(0, 0.1)),
    },
    {
      field: 'securityDeposit', label: 'Security deposit',
      stored: fmtMoney(storedDeposit), extracted: fmtMoney(extracted.securityDeposit),
      status: numStatus(storedDeposit, extracted.securityDeposit, within(1, 1)),
    },
    {
      field: 'sqft', label: 'Square footage',
      stored: fmtNum(storedSqft), extracted: fmtNum(extracted.sqft),
      status: numStatus(storedSqft, extracted.sqft, within(1, 1)),
    },
    {
      field: 'leaseType', label: 'Lease type',
      stored: lease.type, extracted: extracted.leaseType,
      status: strStatus(lease.type, extracted.leaseType, (a, b) => a.toUpperCase() === b.toUpperCase()),
    },
    {
      field: 'propertyAddress', label: 'Property address',
      stored: lease.property.address, extracted: extracted.propertyAddress,
      status: strStatus(lease.property.address, extracted.propertyAddress, eqLoose),
    },
  ];

  return {
    leaseId,
    extracted,
    comparisons,
    matchCount: comparisons.filter((c) => c.status === 'match').length,
    mismatchCount: comparisons.filter((c) => c.status === 'mismatch').length,
    missingCount: comparisons.filter((c) => c.status === 'missing_in_document').length,
  };
}
