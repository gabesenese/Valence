import { parse } from 'csv-parse/sync';
import { prisma } from '../../infrastructure/database';
import { PLAN_LIMITS } from '../plans/plans.service';
import type { Plan, PropertyType, LeaseType } from '@prisma/client';

export interface ImportResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

function parseRows(buffer: Buffer): Record<string, string>[] {
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];
}

function toDate(val: string, field: string): string {
  if (!val) throw new Error(`${field} is required (YYYY-MM-DD)`);
  const d = new Date(val);
  if (isNaN(d.getTime())) throw new Error(`${field} is not a valid date: "${val}"`);
  return d.toISOString();
}

// ─── Properties ───────────────────────────────────────────────────────────────

const VALID_PROPERTY_TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE', 'INDUSTRIAL', 'RETAIL', 'OFFICE'];

export async function importProperties(buffer: Buffer, plan: Plan): Promise<ImportResult> {
  const rows = parseRows(buffer);
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };
  const limit = PLAN_LIMITS[plan].properties;
  const startCount = await prisma.property.count();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];

    if (limit !== Infinity && startCount + result.created >= limit) {
      result.errors.push({ row: rowNum, message: `Plan limit of ${limit} properties reached — upgrade to import more` });
      result.skipped++;
      continue;
    }

    try {
      const { name, code, type, address, city, state, zipCode, totalUnits, totalSqft } = row;
      if (!name) throw new Error('name is required');
      if (!code) throw new Error('code is required');
      if (!type) throw new Error('type is required (RESIDENTIAL, COMMERCIAL, MIXED_USE, INDUSTRIAL, RETAIL, OFFICE)');
      if (!address) throw new Error('address is required');
      if (!city) throw new Error('city is required');
      if (!state) throw new Error('state is required (2-letter)');
      if (!zipCode) throw new Error('zipCode is required');
      if (!totalUnits) throw new Error('totalUnits is required');
      if (!totalSqft) throw new Error('totalSqft is required');

      const normalType = type.toUpperCase();
      if (!VALID_PROPERTY_TYPES.includes(normalType)) {
        throw new Error(`type must be one of: ${VALID_PROPERTY_TYPES.join(', ')}`);
      }

      const normalCode = code.toUpperCase().trim();
      const existing = await prisma.property.findUnique({ where: { code: normalCode } });
      if (existing) {
        result.errors.push({ row: rowNum, message: `Property code "${normalCode}" already exists — skipped` });
        result.skipped++;
        continue;
      }

      await prisma.property.create({
        data: {
          name: name.trim(),
          code: normalCode,
          type: normalType as PropertyType,
          address: address.trim(),
          city: city.trim(),
          state: state.toUpperCase().trim(),
          zipCode: zipCode.trim(),
          country: row.country?.trim() || 'US',
          totalUnits: parseInt(totalUnits),
          totalSqft: parseFloat(totalSqft),
          ...(row.yearBuilt && { yearBuilt: parseInt(row.yearBuilt) }),
          ...(row.purchasePrice && { purchasePrice: parseFloat(row.purchasePrice) }),
          ...(row.currentValue && { currentValue: parseFloat(row.currentValue) }),
          ...(row.purchaseDate && { purchaseDate: new Date(row.purchaseDate) }),
        },
      });

      result.created++;
    } catch (err) {
      result.errors.push({ row: rowNum, message: err instanceof Error ? err.message : 'Unknown error' });
      result.skipped++;
    }
  }

  return result;
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function importTenants(buffer: Buffer): Promise<ImportResult> {
  const rows = parseRows(buffer);
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];

    try {
      if (!row.name) throw new Error('name is required');

      if (row.email) {
        const existing = await prisma.tenant.findUnique({ where: { email: row.email.trim() } });
        if (existing) {
          result.errors.push({ row: rowNum, message: `Tenant with email "${row.email}" already exists — skipped` });
          result.skipped++;
          continue;
        }
      }

      await prisma.tenant.create({
        data: {
          name: row.name.trim(),
          ...(row.email && { email: row.email.trim() }),
          ...(row.phone && { phone: row.phone.trim() }),
          ...(row.company && { company: row.company.trim() }),
          ...(row.creditScore && { creditScore: parseInt(row.creditScore) }),
          ...(row.notes && { notes: row.notes.trim() }),
        },
      });

      result.created++;
    } catch (err) {
      result.errors.push({ row: rowNum, message: err instanceof Error ? err.message : 'Unknown error' });
      result.skipped++;
    }
  }

  return result;
}

// ─── Leases ───────────────────────────────────────────────────────────────────

const VALID_LEASE_TYPES = ['GROSS', 'NET', 'MODIFIED_GROSS', 'PERCENTAGE', 'GROUND'];

async function resolveTenant(name: string, email?: string): Promise<string> {
  if (email) {
    const byEmail = await prisma.tenant.findUnique({ where: { email: email.trim() } });
    if (byEmail) return byEmail.id;
    const created = await prisma.tenant.create({ data: { name: name.trim(), email: email.trim() } });
    return created.id;
  }

  const byName = await prisma.tenant.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' } },
  });
  if (byName) return byName.id;
  const created = await prisma.tenant.create({ data: { name: name.trim() } });
  return created.id;
}

export async function importLeases(buffer: Buffer, plan: Plan): Promise<ImportResult> {
  const rows = parseRows(buffer);
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };
  const limit = PLAN_LIMITS[plan].leases;
  const startCount = await prisma.lease.count();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];

    if (limit !== Infinity && startCount + result.created >= limit) {
      result.errors.push({ row: rowNum, message: `Plan limit of ${limit.toLocaleString()} leases reached — upgrade to import more` });
      result.skipped++;
      continue;
    }

    try {
      const { propertyCode, tenantName, leaseNumber, startDate, endDate, baseRent } = row;
      if (!propertyCode) throw new Error('propertyCode is required');
      if (!tenantName) throw new Error('tenantName is required');
      if (!leaseNumber) throw new Error('leaseNumber is required');
      if (!startDate) throw new Error('startDate is required (YYYY-MM-DD)');
      if (!endDate) throw new Error('endDate is required (YYYY-MM-DD)');
      if (!baseRent) throw new Error('baseRent is required');

      const property = await prisma.property.findUnique({ where: { code: propertyCode.toUpperCase().trim() } });
      if (!property) throw new Error(`Property with code "${propertyCode}" not found`);

      const existingLease = await prisma.lease.findUnique({ where: { leaseNumber: leaseNumber.trim() } });
      if (existingLease) {
        result.errors.push({ row: rowNum, message: `Lease number "${leaseNumber}" already exists — skipped` });
        result.skipped++;
        continue;
      }

      const tenantId = await resolveTenant(tenantName, row.tenantEmail || undefined);

      const leaseType = row.type ? row.type.toUpperCase() : 'GROSS';
      if (!VALID_LEASE_TYPES.includes(leaseType)) {
        throw new Error(`type must be one of: ${VALID_LEASE_TYPES.join(', ')}`);
      }

      await prisma.lease.create({
        data: {
          leaseNumber: leaseNumber.trim(),
          propertyId: property.id,
          tenantId,
          startDate: new Date(toDate(startDate, 'startDate')),
          endDate: new Date(toDate(endDate, 'endDate')),
          baseRent: parseFloat(baseRent),
          type: leaseType as LeaseType,
          ...(row.unitNumber && { unitNumber: row.unitNumber.trim() }),
          ...(row.rentEscalation && { rentEscalation: parseFloat(row.rentEscalation) }),
          ...(row.securityDeposit && { securityDeposit: parseFloat(row.securityDeposit) }),
          ...(row.sqft && { sqft: parseFloat(row.sqft) }),
          ...(row.notes && { notes: row.notes.trim() }),
        },
      });

      result.created++;
    } catch (err) {
      result.errors.push({ row: rowNum, message: err instanceof Error ? err.message : 'Unknown error' });
      result.skipped++;
    }
  }

  return result;
}
