import { z } from 'zod';
import { LeaseStatus, LeaseType, RenewalRisk, RenewalStage } from '@prisma/client';

export const createLeaseSchema = z.object({
  propertyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  unitNumber: z.string().optional(),
  type: z.nativeEnum(LeaseType).default('GROSS'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  renewalDate: z.string().datetime().optional(),
  baseRent: z.number().positive(),
  rentEscalation: z.number().min(0).max(1).default(0),
  securityDeposit: z.number().positive().optional(),
  sqft: z.number().positive().optional(),
  terms: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

export const updateLeaseSchema = createLeaseSchema.partial().extend({
  status: z.nativeEnum(LeaseStatus).optional(),
  renewalRisk: z.nativeEnum(RenewalRisk).optional(),
  renewalStage: z.nativeEnum(RenewalStage).optional(),
  terminationReason: z.string().optional(),
  renewalDate: z.string().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  securityDeposit: z.number().positive().nullable().optional(),
  sqft: z.number().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const leaseQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(LeaseStatus).optional(),
  renewalRisk: z.nativeEnum(RenewalRisk).optional(),
  renewalStage: z.nativeEnum(RenewalStage).optional(),
  propertyId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  expiringWithinDays: z.coerce.number().int().positive().optional(),
  hasAlerts: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  search: z.string().optional(),
  sortBy: z.enum(['endDate', 'baseRent', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const setRenewalDateSchema = z.object({
  renewalDate: z.string(),
});

export const assignOwnerSchema = z.object({
  ownerUserId: z.string().uuid(),
});

export const snoozeSchema = z.object({
  days: z.coerce.number().int().positive().default(7),
});

export const advanceStageSchema = z.object({
  stage: z.nativeEnum(RenewalStage),
});

export const bulkActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(['assignOwner', 'startRenewal', 'markReviewed', 'addNote', 'exportCsv']),
  ownerUserId: z.string().uuid().optional(),
  note: z.string().min(1).max(4000).optional(),
});

export const addNoteSchema = z.object({
  body: z.string().min(1).max(4000),
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
export type LeaseQuery = z.infer<typeof leaseQuerySchema>;
export type BulkActionInput = z.infer<typeof bulkActionSchema>;
export type AddNoteInput = z.infer<typeof addNoteSchema>;
