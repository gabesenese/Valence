import { PrismaClient, PropertyType, LeaseType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addMonths, subMonths, addDays } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Users ────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@valence.dev' },
    update: {},
    create: {
      email: 'admin@valence.dev',
      passwordHash: adminPassword,
      firstName: 'Alex',
      lastName: 'Morgan',
      role: 'ADMIN',
    },
  });

  const analystPassword = await bcrypt.hash('Analyst1234!', 12);
  await prisma.user.upsert({
    where: { email: 'analyst@valence.dev' },
    update: {},
    create: {
      email: 'analyst@valence.dev',
      passwordHash: analystPassword,
      firstName: 'Jordan',
      lastName: 'Rivera',
      role: 'ANALYST',
    },
  });

  console.log('✓ Users');

  // ─── Properties ───────────────────────────────────────────────────────────
  const properties = await Promise.all([
    prisma.property.upsert({
      where: { code: 'MID-001' },
      update: {},
      create: {
        name: 'Midtown Office Tower',
        code: 'MID-001',
        type: PropertyType.OFFICE,
        address: '1200 Avenue of the Americas',
        city: 'New York',
        state: 'NY',
        zipCode: '10036',
        totalUnits: 24,
        totalSqft: 185000,
        yearBuilt: 1998,
        currentValue: 94000000,
        purchasePrice: 72000000,
        purchaseDate: new Date('2015-03-15'),
      },
    }),
    prisma.property.upsert({
      where: { code: 'WFD-001' },
      update: {},
      create: {
        name: 'Waterfront Mixed-Use Complex',
        code: 'WFD-001',
        type: PropertyType.MIXED_USE,
        address: '450 Riverside Drive',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60611',
        totalUnits: 120,
        totalSqft: 310000,
        yearBuilt: 2008,
        currentValue: 142000000,
        purchasePrice: 98000000,
        purchaseDate: new Date('2018-07-01'),
      },
    }),
    prisma.property.upsert({
      where: { code: 'TEC-001' },
      update: {},
      create: {
        name: 'Tech Quarter Industrial Park',
        code: 'TEC-001',
        type: PropertyType.INDUSTRIAL,
        address: '8900 Innovation Drive',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        totalUnits: 18,
        totalSqft: 420000,
        yearBuilt: 2015,
        currentValue: 67000000,
        purchasePrice: 48000000,
        purchaseDate: new Date('2020-01-15'),
      },
    }),
  ]);

  console.log('✓ Properties');

  // ─── Tenants ──────────────────────────────────────────────────────────────
  const tenants = await Promise.all([
    prisma.tenant.upsert({
      where: { email: 'leasing@stratosfinancial.com' },
      update: {},
      create: { name: 'Stratos Financial Corp', email: 'leasing@stratosfinancial.com', company: 'Stratos Financial', creditScore: 820 },
    }),
    prisma.tenant.upsert({
      where: { email: 'facilities@nexustech.io' },
      update: {},
      create: { name: 'Nexus Technology Inc', email: 'facilities@nexustech.io', company: 'Nexus Technology', creditScore: 795 },
    }),
    prisma.tenant.upsert({
      where: { email: 'realestate@alphalogistics.com' },
      update: {},
      create: { name: 'Alpha Logistics Group', email: 'realestate@alphalogistics.com', company: 'Alpha Logistics', creditScore: 760 },
    }),
    prisma.tenant.upsert({
      where: { email: 'admin@vertexconsulting.com' },
      update: {},
      create: { name: 'Vertex Consulting LLC', email: 'admin@vertexconsulting.com', company: 'Vertex Consulting', creditScore: 840 },
    }),
    prisma.tenant.upsert({
      where: { email: 'space@prismretail.com' },
      update: {},
      create: { name: 'Prism Retail Partners', email: 'space@prismretail.com', company: 'Prism Retail', creditScore: 710 },
    }),
  ]);

  console.log('✓ Tenants');

  // ─── Leases ───────────────────────────────────────────────────────────────
  const now = new Date();
  const leases = await Promise.all([
    prisma.lease.upsert({
      where: { leaseNumber: 'LSE-MID-001-A' },
      update: {},
      create: {
        leaseNumber: 'LSE-MID-001-A',
        propertyId: properties[0].id,
        tenantId: tenants[0].id,
        unitNumber: 'Suite 2400',
        type: LeaseType.GROSS,
        status: 'ACTIVE',
        renewalRisk: 'LOW',
        startDate: subMonths(now, 18),
        endDate: addMonths(now, 18),
        baseRent: 48500,
        rentEscalation: 0.03,
        securityDeposit: 97000,
        sqft: 8200,
      },
    }),
    prisma.lease.upsert({
      where: { leaseNumber: 'LSE-MID-001-B' },
      update: {},
      create: {
        leaseNumber: 'LSE-MID-001-B',
        propertyId: properties[0].id,
        tenantId: tenants[3].id,
        unitNumber: 'Suite 1800',
        type: LeaseType.MODIFIED_GROSS,
        status: 'ACTIVE',
        renewalRisk: 'CRITICAL',
        startDate: subMonths(now, 24),
        endDate: addDays(now, 22),
        baseRent: 32000,
        rentEscalation: 0.025,
        securityDeposit: 64000,
        sqft: 5400,
      },
    }),
    prisma.lease.upsert({
      where: { leaseNumber: 'LSE-WFD-001-A' },
      update: {},
      create: {
        leaseNumber: 'LSE-WFD-001-A',
        propertyId: properties[1].id,
        tenantId: tenants[1].id,
        unitNumber: '3F-North',
        type: LeaseType.NET,
        status: 'ACTIVE',
        renewalRisk: 'HIGH',
        startDate: subMonths(now, 12),
        endDate: addDays(now, 55),
        baseRent: 22000,
        rentEscalation: 0.03,
        sqft: 3800,
      },
    }),
    prisma.lease.upsert({
      where: { leaseNumber: 'LSE-TEC-001-A' },
      update: {},
      create: {
        leaseNumber: 'LSE-TEC-001-A',
        propertyId: properties[2].id,
        tenantId: tenants[2].id,
        unitNumber: 'Bay 12-14',
        type: LeaseType.NET,
        status: 'ACTIVE',
        renewalRisk: 'MEDIUM',
        startDate: subMonths(now, 6),
        endDate: addDays(now, 78),
        baseRent: 41000,
        rentEscalation: 0.035,
        sqft: 28000,
      },
    }),
    prisma.lease.upsert({
      where: { leaseNumber: 'LSE-WFD-001-B' },
      update: {},
      create: {
        leaseNumber: 'LSE-WFD-001-B',
        propertyId: properties[1].id,
        tenantId: tenants[4].id,
        unitNumber: 'Ground Floor Retail',
        type: LeaseType.PERCENTAGE,
        status: 'ACTIVE',
        renewalRisk: 'LOW',
        startDate: subMonths(now, 8),
        endDate: addMonths(now, 28),
        baseRent: 18500,
        rentEscalation: 0.02,
        sqft: 2400,
      },
    }),
  ]);

  console.log('✓ Leases');

  // ─── Financial Records ────────────────────────────────────────────────────
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    for (const lease of leases) {
      await prisma.financialRecord.create({
        data: {
          propertyId: lease.propertyId,
          leaseId: lease.id,
          type: 'REVENUE',
          status: 'RECONCILED',
          amount: Number(lease.baseRent) * (1 + (Math.random() * 0.04 - 0.02)),
          periodStart: monthStart,
          periodEnd: monthEnd,
          paidDate: new Date(monthStart.getTime() + 5 * 86400000),
          description: 'Monthly rent',
          category: 'RENT',
        },
      });
    }

    // Expenses per property
    for (const property of properties) {
      await prisma.financialRecord.create({
        data: {
          propertyId: property.id,
          type: 'EXPENSE',
          status: 'RECONCILED',
          amount: 8500 + Math.random() * 4000,
          periodStart: monthStart,
          periodEnd: monthEnd,
          description: 'Operating expenses',
          category: 'OPERATIONS',
        },
      });
    }
  }

  console.log('✓ Financial records');

  // ─── Alerts ───────────────────────────────────────────────────────────────
  await prisma.alert.createMany({
    data: [
      {
        type: 'LEASE_EXPIRATION',
        severity: 'CRITICAL',
        title: 'Lease expiring in 22 days',
        description: `Lease LSE-MID-001-B for Vertex Consulting expires in 22 days with no renewal indication.`,
        propertyId: properties[0].id,
        leaseId: leases[1].id,
        createdById: admin.id,
        metadata: { daysLeft: 22, renewalRisk: 'CRITICAL' },
      },
      {
        type: 'RENEWAL_RISK',
        severity: 'WARNING',
        title: 'High renewal risk — Nexus Technology',
        description: 'Lease LSE-WFD-001-A expires in 55 days. Tenant has not responded to renewal outreach.',
        propertyId: properties[1].id,
        leaseId: leases[2].id,
        createdById: admin.id,
        metadata: { daysLeft: 55, renewalRisk: 'HIGH' },
      },
      {
        type: 'FINANCIAL_DISCREPANCY',
        severity: 'WARNING',
        title: 'Revenue reconciliation gap detected',
        description: 'October revenue for Waterfront Mixed-Use is $1,240 below expected based on lease terms.',
        propertyId: properties[1].id,
        createdById: admin.id,
        metadata: { discrepancy: 1240, period: 'October' },
      },
    ],
  });

  console.log('✓ Alerts');
  console.log('\n✅ Seed complete');
  console.log('\nLogin credentials:');
  console.log('  Admin:   admin@valence.dev / Admin1234!');
  console.log('  Analyst: analyst@valence.dev / Analyst1234!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
