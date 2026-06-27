import { LeaseType } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { updateLease } from '../leases/leases.service';
import type { UpdateLeaseInput } from '../leases/leases.schemas';
import type { ExtractedLease } from './lease-extractor.service';

const LEASE_TYPES = Object.values(LeaseType) as string[];
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isDateStr = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const APPLICABLE_FIELDS = [
  'unitNumber', 'startDate', 'endDate', 'baseRent',
  'rentEscalation', 'securityDeposit', 'sqft', 'leaseType',
] as const;

export async function applyExtractedLease(leaseId: string, userId: string, fields: Partial<ExtractedLease>) {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, deletedAt: null, property: { ownerId: userId, deletedAt: null } },
    select: { id: true },
  });
  if (!lease) throw new NotFoundError('Lease');

  const update: UpdateLeaseInput = {};
  const applied: string[] = [];

  if (typeof fields.unitNumber === 'string' && fields.unitNumber.trim()) {
    update.unitNumber = fields.unitNumber.trim();
    applied.push('unitNumber');
  }
  if (isDateStr(fields.startDate)) {
    update.startDate = fields.startDate;
    applied.push('startDate');
  }
  if (isDateStr(fields.endDate)) {
    update.endDate = fields.endDate;
    applied.push('endDate');
  }
  if (isNum(fields.baseRent) && fields.baseRent > 0) {
    update.baseRent = fields.baseRent;
    applied.push('baseRent');
  }
  if (isNum(fields.rentEscalation) && fields.rentEscalation >= 0) {
    update.rentEscalation = Math.min(1, fields.rentEscalation / 100);
    applied.push('rentEscalation');
  }
  if (isNum(fields.securityDeposit) && fields.securityDeposit > 0) {
    update.securityDeposit = fields.securityDeposit;
    applied.push('securityDeposit');
  }
  if (isNum(fields.sqft) && fields.sqft > 0) {
    update.sqft = fields.sqft;
    applied.push('sqft');
  }
  if (typeof fields.leaseType === 'string' && LEASE_TYPES.includes(fields.leaseType)) {
    update.type = fields.leaseType as LeaseType;
    applied.push('leaseType');
  }

  if (applied.length === 0) throw new ValidationError('No applicable fields to apply from the document.');

  const updated = await updateLease(leaseId, update);
  return { applied, lease: updated };
}
