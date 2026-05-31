import { z } from 'zod';
import { LeaseStatus, LeaseType, RenewalRisk } from '@prisma/client';

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
  terminationReason: z.string().optional(),
});

export const leaseQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(LeaseStatus).optional(),
  renewalRisk: z.nativeEnum(RenewalRisk).optional(),
  propertyId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  expiringWithinDays: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
export type LeaseQuery = z.infer<typeof leaseQuerySchema>;
