import { parse } from 'csv-parse/sync';
import { prisma } from '../../infrastructure/database';
import { PLAN_LIMITS } from '../plans/plans.service';
import type { Plan, PropertyType, LeaseType } from '@prisma/client';

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  currentCount?: number;
  planLimit?: number;
}

export type ColumnMap = Record<string, string>; 
export type FieldDefaults = Record<string, string>;

function applyColumnMap(row: Record<string, string>, map: ColumnMap, defaults?: FieldDefaults): Record<string, string> {
  const result = { ...row };
  // Defaults applied first — column mappings override them
  if (defaults) {
    for (const [field, val] of Object.entries(defaults)) {
      if (val) result[field] = val;
    }
  }
  for (const [csvCol, valenceField] of Object.entries(map)) {
    if (valenceField && Object.prototype.hasOwnProperty.call(row, csvCol)) {
      result[valenceField] = row[csvCol];
    }
  }
  return result;
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

export async function importProperties(buffer: Buffer, plan: Plan, userId: string, columnMap?: ColumnMap, defaults?: FieldDefaults): Promise<ImportResult> {
  const rows = parseRows(buffer);
  const limit = PLAN_LIMITS[plan].properties;
  const startCount = await prisma.property.count({ where: { ownerId: userId } });
  // Only net-new properties count against the plan limit; updates are free
  const netNewAllowed = limit === Infinity ? Infinity : Math.max(0, limit - startCount);
  let netNewCreated = 0;
  const result: ImportResult = {
    created: 0, updated: 0, skipped: 0, errors: [],
    currentCount: startCount,
    planLimit: limit === Infinity ? undefined : limit,
  };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = (columnMap || defaults) ? applyColumnMap(rows[i], columnMap ?? {}, defaults) : rows[i];

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

      const normalType = VALID_PROPERTY_TYPES.includes(type.toUpperCase()) ? type.toUpperCase() : 'RESIDENTIAL';
      const normalCode = code.toUpperCase().trim();
      const existing = await prisma.property.findFirst({ where: { code: normalCode, ownerId: userId, deletedAt: null } });

      if (existing) {
        await prisma.property.update({
          where: { id: existing.id },
          data: {
            name: name.trim(),
            type: normalType as PropertyType,
            address: address.trim(),
            city: city.trim(),
            state: state.toUpperCase().trim(),
            zipCode: zipCode.trim(),
            ...(row.country && { country: row.country.trim() }),
            totalUnits: parseInt(totalUnits),
            totalSqft: totalSqft ? parseFloat(totalSqft) : existing.totalSqft,
            ...(row.yearBuilt && { yearBuilt: parseInt(row.yearBuilt) }),
            ...(row.purchasePrice && { purchasePrice: parseFloat(row.purchasePrice) }),
            ...(row.currentValue && { currentValue: parseFloat(row.currentValue) }),
            ...(row.purchaseDate && { purchaseDate: new Date(row.purchaseDate) }),
          },
        });
        result.updated++;
        continue;
      }

      // New property — check plan limit
      if (netNewAllowed !== Infinity && netNewCreated >= netNewAllowed) {
        result.errors.push({ row: rowNum, message: `Your ${plan} plan includes up to ${limit} properties and you've reached the limit — upgrade your plan to import more` });
        result.skipped++;
        continue;
      }

      await prisma.property.create({
        data: {
          ownerId: userId,
          name: name.trim(),
          code: normalCode,
          type: normalType as PropertyType,
          address: address.trim(),
          city: city.trim(),
          state: state.toUpperCase().trim(),
          zipCode: zipCode.trim(),
          country: row.country?.trim() || 'CA',
          totalUnits: parseInt(totalUnits),
          totalSqft: totalSqft ? parseFloat(totalSqft) : 0,
          ...(row.yearBuilt && { yearBuilt: parseInt(row.yearBuilt) }),
          ...(row.purchasePrice && { purchasePrice: parseFloat(row.purchasePrice) }),
          ...(row.currentValue && { currentValue: parseFloat(row.currentValue) }),
          ...(row.purchaseDate && { purchaseDate: new Date(row.purchaseDate) }),
        },
      });
      netNewCreated++;
      result.created++;
    } catch (err) {
      result.errors.push({ row: rowNum, message: err instanceof Error ? err.message : 'Unknown error' });
      result.skipped++;
    }
  }

  return result;
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function importTenants(buffer: Buffer, userId: string, columnMap?: ColumnMap, defaults?: FieldDefaults): Promise<ImportResult> {
  const rows = parseRows(buffer);
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = (columnMap || defaults) ? applyColumnMap(rows[i], columnMap ?? {}, defaults) : rows[i];

    try {
      if (!row.name) throw new Error('name is required');

      if (row.email) {
        const existing = await prisma.tenant.findFirst({ where: { email: row.email.trim(), ownerId: userId } });
        if (existing) {
          result.errors.push({ row: rowNum, message: `Tenant with email "${row.email}" already exists — skipped` });
          result.skipped++;
          continue;
        }
      } else {
        const existing = await prisma.tenant.findFirst({ where: { ownerId: userId, name: { equals: row.name.trim(), mode: 'insensitive' } } });
        if (existing) {
          result.errors.push({ row: rowNum, message: `Tenant "${row.name}" already exists — skipped` });
          result.skipped++;
          continue;
        }
      }

      await prisma.tenant.create({
        data: {
          ownerId: userId,
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

async function resolveTenant(name: string, userId: string, email?: string): Promise<string> {
  if (email) {
    const byEmail = await prisma.tenant.findFirst({ where: { email: email.trim(), ownerId: userId } });
    if (byEmail) return byEmail.id;
    const created = await prisma.tenant.create({ data: { ownerId: userId, name: name.trim(), email: email.trim() } });
    return created.id;
  }

  const byName = await prisma.tenant.findFirst({
    where: { ownerId: userId, name: { equals: name.trim(), mode: 'insensitive' } },
  });
  if (byName) return byName.id;
  const created = await prisma.tenant.create({ data: { ownerId: userId, name: name.trim() } });
  return created.id;
}

export async function importLeases(buffer: Buffer, plan: Plan, userId: string, columnMap?: ColumnMap, defaults?: FieldDefaults): Promise<ImportResult> {
  const rows = parseRows(buffer);
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const limit = PLAN_LIMITS[plan].leases;
  const startCount = await prisma.lease.count({ where: { property: { ownerId: userId } } });

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = (columnMap || defaults) ? applyColumnMap(rows[i], columnMap ?? {}, defaults) : rows[i];

    if (limit !== Infinity && startCount + result.created >= limit) {
      result.errors.push({ row: rowNum, message: `Your ${plan} plan includes up to ${limit.toLocaleString()} leases and you've reached the limit — upgrade your plan to import more` });
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

      const property = await prisma.property.findFirst({ where: { code: propertyCode.toUpperCase().trim(), ownerId: userId, deletedAt: null } });
      if (!property) throw new Error(`Property with code "${propertyCode}" not found`);

      const existingLease = await prisma.lease.findUnique({ where: { leaseNumber_propertyId: { leaseNumber: leaseNumber.trim(), propertyId: property.id } } });
      if (existingLease) {
        result.errors.push({ row: rowNum, message: `Lease number "${leaseNumber}" already exists on this property — skipped` });
        result.skipped++;
        continue;
      }

      const tenantId = await resolveTenant(tenantName, userId, row.tenantEmail || undefined);

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
