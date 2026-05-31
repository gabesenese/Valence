import { z } from 'zod';
import { PropertyType, PropertyStatus } from '@prisma/client';

export const createPropertySchema = z.object({
  name: z.string().min(1).max(200).trim(),
  code: z.string().min(2).max(20).toUpperCase().trim(),
  type: z.nativeEnum(PropertyType),
  status: z.nativeEnum(PropertyStatus).optional(),
  address: z.string().min(1).max(500).trim(),
  city: z.string().min(1).max(100).trim(),
  state: z.string().min(2).max(2).toUpperCase().trim(),
  zipCode: z.string().min(5).max(10).trim(),
  country: z.string().default('US'),
  totalUnits: z.number().int().positive(),
  totalSqft: z.number().positive(),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  purchaseDate: z.string().datetime().optional(),
  purchasePrice: z.number().positive().optional(),
  currentValue: z.number().positive().optional(),
});

export const updatePropertySchema = createPropertySchema.partial();

export const propertyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(PropertyStatus).optional(),
  type: z.nativeEnum(PropertyType).optional(),
  search: z.string().optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyQuery = z.infer<typeof propertyQuerySchema>;
