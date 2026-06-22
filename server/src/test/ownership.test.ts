import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression guard for the IDOR fix. The ownership asserters are the single
 * choke point behind requireOwner() on every /:id route. A user must never be
 * able to read or mutate a record they don't own — and a non-owner must get a
 * NotFoundError (not Forbidden), so they can't even confirm the id exists.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    property:        { findUnique: vi.fn() },
    lease:           { findUnique: vi.fn() },
    tenant:          { findUnique: vi.fn() },
    financialRecord: { findUnique: vi.fn() },
    alert:           { findUnique: vi.fn() },
    task:            { findUnique: vi.fn() },
    document:        { findUnique: vi.fn() },
    contactLog:      { findUnique: vi.fn() },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

import {
  assertPropertyOwner,
  assertLeaseOwner,
  assertTenantOwner,
  assertFinancialRecordOwner,
  assertAlertOwner,
  assertTaskOwner,
  assertDocumentOwner,
  assertContactLogOwner,
} from '../utils/ownership';
import { NotFoundError } from '../utils/errors';

const OWNER = 'user-A';
const ATTACKER = 'user-B';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ownership asserters — tenant isolation', () => {
  it('property: allows the owner, blocks others, blocks soft-deleted and missing', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ ownerId: OWNER, deletedAt: null });
    await expect(assertPropertyOwner('p1', OWNER)).resolves.toBeUndefined();

    prismaMock.property.findUnique.mockResolvedValue({ ownerId: OWNER, deletedAt: null });
    await expect(assertPropertyOwner('p1', ATTACKER)).rejects.toBeInstanceOf(NotFoundError);

    prismaMock.property.findUnique.mockResolvedValue({ ownerId: OWNER, deletedAt: new Date('2026-01-01') });
    await expect(assertPropertyOwner('p1', OWNER)).rejects.toBeInstanceOf(NotFoundError);

    prismaMock.property.findUnique.mockResolvedValue(null);
    await expect(assertPropertyOwner('missing', OWNER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lease: ownership resolved via property.ownerId', async () => {
    prismaMock.lease.findUnique.mockResolvedValue({ property: { ownerId: OWNER } });
    await expect(assertLeaseOwner('l1', OWNER)).resolves.toBeUndefined();

    prismaMock.lease.findUnique.mockResolvedValue({ property: { ownerId: OWNER } });
    await expect(assertLeaseOwner('l1', ATTACKER)).rejects.toBeInstanceOf(NotFoundError);

    prismaMock.lease.findUnique.mockResolvedValue(null);
    await expect(assertLeaseOwner('missing', OWNER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('tenant: allows owner, blocks others', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ ownerId: OWNER });
    await expect(assertTenantOwner('t1', OWNER)).resolves.toBeUndefined();

    prismaMock.tenant.findUnique.mockResolvedValue({ ownerId: OWNER });
    await expect(assertTenantOwner('t1', ATTACKER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('financialRecord: ownership resolved via property.ownerId', async () => {
    prismaMock.financialRecord.findUnique.mockResolvedValue({ property: { ownerId: OWNER } });
    await expect(assertFinancialRecordOwner('f1', OWNER)).resolves.toBeUndefined();

    prismaMock.financialRecord.findUnique.mockResolvedValue({ property: { ownerId: OWNER } });
    await expect(assertFinancialRecordOwner('f1', ATTACKER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('alert: owned via property OR lease.property', async () => {
    prismaMock.alert.findUnique.mockResolvedValue({ property: { ownerId: OWNER }, lease: null });
    await expect(assertAlertOwner('a1', OWNER)).resolves.toBeUndefined();

    prismaMock.alert.findUnique.mockResolvedValue({ property: null, lease: { property: { ownerId: OWNER } } });
    await expect(assertAlertOwner('a1', OWNER)).resolves.toBeUndefined();

    prismaMock.alert.findUnique.mockResolvedValue({ property: { ownerId: OWNER }, lease: null });
    await expect(assertAlertOwner('a1', ATTACKER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('task: owned via property/lease/alert or creator/assignee', async () => {
    const base = { createdById: null, assigneeUserId: null, property: null, lease: null, alert: null };
    prismaMock.task.findUnique.mockResolvedValue({ ...base, createdById: OWNER });
    await expect(assertTaskOwner('tk1', OWNER)).resolves.toBeUndefined();

    prismaMock.task.findUnique.mockResolvedValue({ ...base, lease: { property: { ownerId: OWNER } } });
    await expect(assertTaskOwner('tk1', OWNER)).resolves.toBeUndefined();

    prismaMock.task.findUnique.mockResolvedValue({ ...base, assigneeUserId: 'someone-else', property: { ownerId: 'someone-else' } });
    await expect(assertTaskOwner('tk1', ATTACKER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('document: owned via uploader or related property/lease/tenant', async () => {
    const base = { uploadedById: null, property: null, lease: null, tenant: null };
    prismaMock.document.findUnique.mockResolvedValue({ ...base, uploadedById: OWNER });
    await expect(assertDocumentOwner('d1', OWNER)).resolves.toBeUndefined();

    prismaMock.document.findUnique.mockResolvedValue({ ...base, tenant: { ownerId: OWNER } });
    await expect(assertDocumentOwner('d1', OWNER)).resolves.toBeUndefined();

    prismaMock.document.findUnique.mockResolvedValue({ ...base, property: { ownerId: 'someone-else' } });
    await expect(assertDocumentOwner('d1', ATTACKER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('contactLog: owned via tenant.ownerId', async () => {
    prismaMock.contactLog.findUnique.mockResolvedValue({ tenant: { ownerId: OWNER } });
    await expect(assertContactLogOwner('c1', OWNER)).resolves.toBeUndefined();

    prismaMock.contactLog.findUnique.mockResolvedValue({ tenant: { ownerId: OWNER } });
    await expect(assertContactLogOwner('c1', ATTACKER)).rejects.toBeInstanceOf(NotFoundError);
  });
});
