import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database';
import { authenticate } from '../../middleware/authenticate';

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

router.get('/properties', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.property.findMany({
      orderBy: { name: 'asc' },
      select: { name: true, code: true, type: true, status: true, address: true, city: true, state: true, zipCode: true, country: true, totalUnits: true, totalSqft: true, yearBuilt: true, purchaseDate: true, purchasePrice: true, currentValue: true, createdAt: true },
    });
    send(res, 'properties.csv', csv(
      ['Name', 'Code', 'Type', 'Status', 'Address', 'City', 'State', 'Zip', 'Country', 'Units', 'Sqft', 'Year Built', 'Purchase Date', 'Purchase Price', 'Current Value', 'Created At'],
      rows.map((r) => [r.name, r.code, r.type, r.status, r.address, r.city, r.state, r.zipCode, r.country, r.totalUnits, r.totalSqft?.toString(), r.yearBuilt, r.purchaseDate?.toISOString().split('T')[0], r.purchasePrice?.toString(), r.currentValue?.toString(), r.createdAt.toISOString()]),
    ));
  } catch (e) { next(e); }
});

router.get('/leases', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.lease.findMany({
      orderBy: { createdAt: 'desc' },
      include: { property: { select: { name: true } }, tenant: { select: { name: true } } },
    });
    send(res, 'leases.csv', csv(
      ['Lease #', 'Property', 'Tenant', 'Unit', 'Type', 'Status', 'Renewal Risk', 'Start Date', 'End Date', 'Base Rent', 'Sqft', 'Created At'],
      rows.map((r) => [r.leaseNumber, r.property.name, r.tenant.name, r.unitNumber, r.type, r.status, r.renewalRisk, r.startDate.toISOString().split('T')[0], r.endDate.toISOString().split('T')[0], r.baseRent.toString(), r.sqft?.toString(), r.createdAt.toISOString()]),
    ));
  } catch (e) { next(e); }
});

router.get('/tenants', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { name: true, email: true, phone: true, company: true, creditScore: true, crmStatus: true, renewalProbability: true, lastContactAt: true, createdAt: true },
    });
    send(res, 'tenants.csv', csv(
      ['Name', 'Email', 'Phone', 'Company', 'Credit Score', 'CRM Status', 'Renewal Probability', 'Last Contact', 'Created At'],
      rows.map((r) => [r.name, r.email, r.phone, r.company, r.creditScore, r.crmStatus, r.renewalProbability, r.lastContactAt?.toISOString().split('T')[0], r.createdAt.toISOString()]),
    ));
  } catch (e) { next(e); }
});

router.get('/tasks', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        assignee: { select: { firstName: true, lastName: true } },
        property: { select: { name: true } },
      },
    });
    send(res, 'tasks.csv', csv(
      ['Title', 'Status', 'Assignee', 'Property', 'Due Date', 'Completed At', 'Created At'],
      rows.map((r) => [r.title, r.status, r.assignee ? `${r.assignee.firstName} ${r.assignee.lastName}` : '', r.property?.name, r.dueAt?.toISOString().split('T')[0], r.completedAt?.toISOString().split('T')[0], r.createdAt.toISOString()]),
    ));
  } catch (e) { next(e); }
});

export { router as exportRouter };
