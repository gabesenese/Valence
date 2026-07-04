import { z } from 'zod';
import { CreditScoreSource } from '@prisma/client';

export const createTenantSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  taxId: z.string().max(50).optional(),
  creditScore: z.number().int().min(300).max(900).optional(),
  creditScoreSource: z.nativeEnum(CreditScoreSource).optional(),
  creditScoreDate: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
});

export const updateTenantSchema = createTenantSchema.partial();

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
