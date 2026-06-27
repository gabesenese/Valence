import { z } from 'zod';
import { FinancialRecordType, FinancialRecordStatus } from '@prisma/client';

export const createFinancialRecordSchema = z.object({
  propertyId: z.string().uuid(),
  leaseId: z.string().uuid().optional(),
  type: z.nativeEnum(FinancialRecordType),
  amount: z.number(),
  currency: z.string().length(3).default('USD'),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  paidDate: z.string().datetime().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

export const updateFinancialRecordSchema = createFinancialRecordSchema.partial().extend({
  status: z.nativeEnum(FinancialRecordStatus).optional(),
  discrepancy: z.number().optional(),
});

export const financeQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.nativeEnum(FinancialRecordType).optional(),
  status: z.nativeEnum(FinancialRecordStatus).optional(),
  category: z.string().optional(),
  propertyId: z.string().uuid().optional(),
  leaseId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const revenueTrendQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
  months: z.coerce.number().int().min(1).max(24).default(12),
});

export const expenseBreakdownQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const expenseTrendQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
  months: z.coerce.number().int().min(2).max(24).default(6),
});

export const forecastQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export type CreateFinancialRecordInput = z.infer<typeof createFinancialRecordSchema>;
export type UpdateFinancialRecordInput = z.infer<typeof updateFinancialRecordSchema>;
export type FinanceQuery = z.infer<typeof financeQuerySchema>;
export type RevenueTrendQuery = z.infer<typeof revenueTrendQuerySchema>;
export type ExpenseBreakdownQuery = z.infer<typeof expenseBreakdownQuerySchema>;
export type ExpenseTrendQuery = z.infer<typeof expenseTrendQuerySchema>;
export type ForecastQuery = z.infer<typeof forecastQuerySchema>;
