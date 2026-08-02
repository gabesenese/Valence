import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import archiver from 'archiver';
import { prisma } from '../../infrastructure/database';
import { authenticate } from '../../middleware/authenticate';
import { decryptField, decryptNumber } from '../../security/field-encryption';
import { logAudit } from '../audit/audit.service';
import { readDocument } from '../documents/storage';

const router = Router();
router.use(authenticate);

function csv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escape = (v: string | number | boolean | null | undefined) => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
}

function send(res: Response, filename: string, body: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}

router.get('/properties', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.property.findMany({
      where: { ownerId: req.user!.id },
      orderBy: { name: 'asc' },
      select: { name: true, code: true, type: true, status: true, address: true, city: true, state: true, zipCode: true, country: true, totalUnits: true, totalSqft: true, yearBuilt: true, purchaseDate: true, purchasePrice: true, currentValue: true, createdAt: true },
    });
    void logAudit({ userId: req.user!.id, action: 'EXPORT', entity: 'property', meta: { count: rows.length } });
    send(res, 'properties.csv', csv(
      ['Name', 'Code', 'Type', 'Status', 'Address', 'City', 'State', 'Zip', 'Country', 'Units', 'Sqft', 'Year Built', 'Purchase Date', 'Purchase Price', 'Current Value', 'Created At'],
      rows.map((r) => [r.name, r.code, r.type, r.status, r.address, r.city, r.state, r.zipCode, r.country, r.totalUnits, r.totalSqft?.toString(), r.yearBuilt, r.purchaseDate?.toISOString().split('T')[0], r.purchasePrice?.toString(), r.currentValue?.toString(), r.createdAt.toISOString()]),
    ));
  } catch (e) { next(e); }
});

router.get('/leases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.lease.findMany({
      where: { property: { ownerId: req.user!.id } },
      orderBy: { createdAt: 'desc' },
      include: { property: { select: { name: true } }, tenant: { select: { name: true } } },
    });
    void logAudit({ userId: req.user!.id, action: 'EXPORT', entity: 'lease', meta: { count: rows.length } });
    send(res, 'leases.csv', csv(
      ['Lease #', 'Property', 'Tenant', 'Unit', 'Type', 'Status', 'Renewal Risk', 'Start Date', 'End Date', 'Base Rent', 'Sqft', 'Created At'],
      rows.map((r) => [r.leaseNumber, r.property.name, r.tenant.name, r.unitNumber, r.type, r.status, r.renewalRisk, r.startDate.toISOString().split('T')[0], r.endDate.toISOString().split('T')[0], r.baseRent.toString(), r.sqft?.toString(), r.createdAt.toISOString()]),
    ));
  } catch (e) { next(e); }
});

router.get('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.tenant.findMany({
      where: { isActive: true, ownerId: req.user!.id },
      orderBy: { name: 'asc' },
      select: { name: true, email: true, phone: true, company: true, creditScore: true, crmStatus: true, renewalProbability: true, lastContactAt: true, createdAt: true },
    });
    void logAudit({ userId: req.user!.id, action: 'EXPORT', entity: 'tenant', meta: { count: rows.length } });
    send(res, 'tenants.csv', csv(
      ['Name', 'Email', 'Phone', 'Company', 'Credit Score', 'CRM Status', 'Renewal Probability', 'Last Contact', 'Created At'],
      rows.map((r) => [r.name, r.email, r.phone, r.company, decryptNumber(r.creditScore), r.crmStatus, r.renewalProbability, r.lastContactAt?.toISOString().split('T')[0], r.createdAt.toISOString()]),
    ));
  } catch (e) { next(e); }
});

router.get('/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const rows = await prisma.task.findMany({
      where: {
        OR: [
          { property: { ownerId: userId } },
          { lease: { property: { ownerId: userId } } },
          { createdById: userId },
          { assigneeUserId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        assignee: { select: { firstName: true, lastName: true } },
        property: { select: { name: true } },
      },
    });
    void logAudit({ userId: req.user!.id, action: 'EXPORT', entity: 'task', meta: { count: rows.length } });
    send(res, 'tasks.csv', csv(
      ['Title', 'Status', 'Assignee', 'Property', 'Due Date', 'Completed At', 'Created At'],
      rows.map((r) => [r.title, r.status, r.assignee ? `${r.assignee.firstName} ${r.assignee.lastName}` : '', r.property?.name, r.dueAt?.toISOString().split('T')[0], r.completedAt?.toISOString().split('T')[0], r.createdAt.toISOString()]),
    ));
  } catch (e) { next(e); }
});

router.get('/bundle', async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  try {
    const [properties, leases, tenants, tasks, financialRecords, documents] = await Promise.all([
      prisma.property.findMany({
        where: { ownerId: userId },
        orderBy: { name: 'asc' },
        select: { name: true, code: true, type: true, status: true, address: true, city: true, state: true, zipCode: true, country: true, totalUnits: true, totalSqft: true, yearBuilt: true, purchaseDate: true, purchasePrice: true, currentValue: true, createdAt: true },
      }),
      prisma.lease.findMany({
        where: { property: { ownerId: userId } },
        orderBy: { createdAt: 'desc' },
        include: { property: { select: { name: true } }, tenant: { select: { name: true } } },
      }),
      prisma.tenant.findMany({
        where: { isActive: true, ownerId: userId },
        orderBy: { name: 'asc' },
        select: { name: true, email: true, phone: true, company: true, taxId: true, creditScore: true, crmStatus: true, renewalProbability: true, lastContactAt: true, createdAt: true },
      }),
      prisma.task.findMany({
        where: { OR: [{ property: { ownerId: userId } }, { lease: { property: { ownerId: userId } } }, { createdById: userId }, { assigneeUserId: userId }] },
        orderBy: { createdAt: 'desc' },
        include: { assignee: { select: { firstName: true, lastName: true } }, property: { select: { name: true } } },
      }),
      prisma.financialRecord.findMany({
        where: { property: { ownerId: userId } },
        orderBy: { periodStart: 'desc' },
        include: { property: { select: { name: true } }, lease: { select: { leaseNumber: true } } },
      }),
      prisma.document.findMany({
        where: { OR: [{ uploadedById: userId }, { property: { ownerId: userId } }, { lease: { property: { ownerId: userId } } }, { tenant: { ownerId: userId } }] },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, originalName: true, type: true, mimeType: true, size: true, path: true, createdAt: true, uploadedBy: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    void logAudit({ userId, action: 'EXPORT', entity: 'organization', meta: { properties: properties.length, leases: leases.length, tenants: tenants.length, tasks: tasks.length, financialRecords: financialRecords.length, documents: documents.length } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="valence-export-${new Date().toISOString().slice(0, 10)}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err: Error) => next(err));
    archive.pipe(res);

    archive.append(csv(
      ['Name', 'Code', 'Type', 'Status', 'Address', 'City', 'State', 'Zip', 'Country', 'Units', 'Sqft', 'Year Built', 'Purchase Date', 'Purchase Price', 'Current Value', 'Created At'],
      properties.map((r) => [r.name, r.code, r.type, r.status, r.address, r.city, r.state, r.zipCode, r.country, r.totalUnits, r.totalSqft?.toString(), r.yearBuilt, r.purchaseDate?.toISOString().split('T')[0], r.purchasePrice?.toString(), r.currentValue?.toString(), r.createdAt.toISOString()]),
    ), { name: 'properties.csv' });

    archive.append(csv(
      ['Lease #', 'Property', 'Tenant', 'Unit', 'Type', 'Status', 'Renewal Risk', 'Start Date', 'End Date', 'Base Rent', 'Sqft', 'Created At'],
      leases.map((r) => [r.leaseNumber, r.property.name, r.tenant.name, r.unitNumber, r.type, r.status, r.renewalRisk, r.startDate.toISOString().split('T')[0], r.endDate.toISOString().split('T')[0], r.baseRent.toString(), r.sqft?.toString(), r.createdAt.toISOString()]),
    ), { name: 'leases.csv' });

    archive.append(csv(
      ['Name', 'Email', 'Phone', 'Company', 'Tax ID', 'Credit Score', 'CRM Status', 'Renewal Probability', 'Last Contact', 'Created At'],
      tenants.map((r) => [r.name, r.email, r.phone, r.company, decryptField(r.taxId), decryptNumber(r.creditScore), r.crmStatus, r.renewalProbability, r.lastContactAt?.toISOString().split('T')[0], r.createdAt.toISOString()]),
    ), { name: 'tenants.csv' });

    archive.append(csv(
      ['Title', 'Status', 'Assignee', 'Property', 'Due Date', 'Completed At', 'Created At'],
      tasks.map((r) => [r.title, r.status, r.assignee ? `${r.assignee.firstName} ${r.assignee.lastName}` : '', r.property?.name, r.dueAt?.toISOString().split('T')[0], r.completedAt?.toISOString().split('T')[0], r.createdAt.toISOString()]),
    ), { name: 'tasks.csv' });

    archive.append(csv(
      ['Property', 'Lease', 'Type', 'Status', 'Amount', 'Category', 'Period Start', 'Period End', 'Due Date', 'Paid Date', 'Description', 'Created At'],
      financialRecords.map((r) => [r.property.name, r.lease?.leaseNumber, r.type, r.status, r.amount.toString(), r.category, r.periodStart.toISOString().split('T')[0], r.periodEnd.toISOString().split('T')[0], r.dueDate?.toISOString().split('T')[0], r.paidDate?.toISOString().split('T')[0], r.description, r.createdAt.toISOString()]),
    ), { name: 'financial-records.csv' });

    archive.append(csv(
      ['File Name', 'Type', 'Size (bytes)', 'Uploaded By', 'Uploaded At', 'Archive Path'],
      documents.map((d) => [d.originalName, d.type, d.size, d.uploadedBy ? `${d.uploadedBy.firstName} ${d.uploadedBy.lastName}` : '', d.createdAt.toISOString(), `documents/${d.id}-${d.originalName}`]),
    ), { name: 'documents.csv' });

    for (const doc of documents) {
      try {
        const { stream } = await readDocument(doc.path);
        archive.append(stream, { name: `documents/${doc.id}-${doc.originalName}` });
      } catch {
        // File missing from storage — the manifest still lists it; skip rather
        // than fail the whole export over one unreadable file.
      }
    }

    await archive.finalize();
  } catch (e) { next(e); }
});

export { router as exportRouter };
