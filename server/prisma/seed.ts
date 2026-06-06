import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays, subDays, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  // ── Clear all domain data ──────────────────────────────────────────────────
  console.log('🧹 Clearing existing data...');
  await prisma.auditLog.deleteMany({});
  await prisma.usageRecord.deleteMany({});
  await prisma.automationLog.deleteMany({});
  await prisma.automationRule.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.insight.deleteMany({});
  await prisma.alertActivity.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.contactLog.deleteMany({});
  await prisma.leaseActivity.deleteMany({});
  await prisma.leaseNote.deleteMany({});
  await prisma.financialRecord.deleteMany({});
  await prisma.lease.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.property.deleteMany({});
  await prisma.jobLock.deleteMany({});
  console.log('✓ Cleared');

  // ── Users ──────────────────────────────────────────────────────────────────
  const superAdminHash = await bcrypt.hash('12345!', 12);
  await prisma.user.upsert({
    where: { email: 'valence_admin@admin.com' },
    update: { role: 'SUPER_ADMIN', plan: 'EXECUTIVE', isActive: true },
    create: {
      email: 'valence_admin@admin.com',
      passwordHash: superAdminHash,
      firstName: 'Valence',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      plan: 'EXECUTIVE',
    },
  });

  const adminHash = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@valence.dev' },
    update: { firstName: 'Alex', lastName: 'Morgan', role: 'ADMIN', plan: 'PROFESSIONAL' },
    create: {
      email: 'admin@valence.dev',
      passwordHash: adminHash,
      firstName: 'Alex',
      lastName: 'Morgan',
      role: 'ADMIN',
      plan: 'PROFESSIONAL',
    },
  });

  const analystHash = await bcrypt.hash('Analyst1234!', 12);
  await prisma.user.upsert({
    where: { email: 'analyst@valence.dev' },
    update: { firstName: 'Jordan', lastName: 'Rivera' },
    create: {
      email: 'analyst@valence.dev',
      passwordHash: analystHash,
      firstName: 'Jordan',
      lastName: 'Rivera',
      role: 'ANALYST',
    },
  });

  // Upgrade owner account if it exists
  await prisma.user.updateMany({
    where: { email: 'sd7y5zfq9m@privaterelay.appleid.com' },
    data: { plan: 'EXECUTIVE', role: 'SUPER_ADMIN' },
  });
  console.log('✓ Users');

  // ── Properties ─────────────────────────────────────────────────────────────
  const [bos, phx, atl, nsh, den, sjc, hou, chs] = await Promise.all([
    prisma.property.create({ data: {
      name: 'Harbor Point Office Center', code: 'BOS-001', type: 'OFFICE',
      address: '75 State Street', city: 'Boston', state: 'MA', zipCode: '02109',
      totalUnits: 10, totalSqft: 58000, yearBuilt: 2002,
      purchaseDate: new Date('2017-04-12'), purchasePrice: 42000000, currentValue: 56000000,
    }}),
    prisma.property.create({ data: {
      name: 'Sunbelt Industrial Park', code: 'PHX-001', type: 'INDUSTRIAL',
      address: '4800 W Lower Buckeye Rd', city: 'Phoenix', state: 'AZ', zipCode: '85043',
      totalUnits: 14, totalSqft: 285000, yearBuilt: 2014,
      purchaseDate: new Date('2019-08-01'), purchasePrice: 38000000, currentValue: 52000000,
    }}),
    prisma.property.create({ data: {
      name: 'Peachtree Corporate Plaza', code: 'ATL-001', type: 'OFFICE',
      address: '3350 Peachtree Rd NE', city: 'Atlanta', state: 'GA', zipCode: '30326',
      totalUnits: 18, totalSqft: 118000, yearBuilt: 2007,
      purchaseDate: new Date('2016-11-30'), purchasePrice: 64000000, currentValue: 87000000,
    }}),
    prisma.property.create({ data: {
      name: 'Lower Broadway Retail Block', code: 'NSH-001', type: 'RETAIL',
      address: '200 Broadway', city: 'Nashville', state: 'TN', zipCode: '37201',
      totalUnits: 22, totalSqft: 34000, yearBuilt: 1994,
      purchaseDate: new Date('2018-03-15'), purchasePrice: 19000000, currentValue: 28000000,
    }}),
    prisma.property.create({ data: {
      name: 'Cherry Creek Mixed-Use Center', code: 'DEN-001', type: 'MIXED_USE',
      address: '250 Fillmore St', city: 'Denver', state: 'CO', zipCode: '80206',
      totalUnits: 56, totalSqft: 88000, yearBuilt: 2010,
      purchaseDate: new Date('2020-06-01'), purchasePrice: 58000000, currentValue: 74000000,
    }}),
    prisma.property.create({ data: {
      name: 'North First Tech Campus', code: 'SJC-001', type: 'OFFICE',
      address: '500 N First St', city: 'San Jose', state: 'CA', zipCode: '95112',
      totalUnits: 6, totalSqft: 210000, yearBuilt: 2012,
      purchaseDate: new Date('2021-01-20'), purchasePrice: 128000000, currentValue: 168000000,
    }}),
    prisma.property.create({ data: {
      name: 'Port Terminal Logistics Park', code: 'HOU-001', type: 'INDUSTRIAL',
      address: '12000 Port Rd', city: 'Houston', state: 'TX', zipCode: '77507',
      totalUnits: 10, totalSqft: 365000, yearBuilt: 2016,
      purchaseDate: new Date('2021-09-15'), purchasePrice: 48000000, currentValue: 63000000,
    }}),
    prisma.property.create({ data: {
      name: 'King Street Retail Row', code: 'CHS-001', type: 'RETAIL',
      address: '412 King Street', city: 'Charleston', state: 'SC', zipCode: '29403',
      totalUnits: 16, totalSqft: 26000, yearBuilt: 1988,
      purchaseDate: new Date('2019-02-28'), purchasePrice: 15000000, currentValue: 22000000,
    }}),
  ]);
  console.log('✓ Properties');

  // ── Tenants ────────────────────────────────────────────────────────────────
  const [
    meridian, cascademed, brightline, summit, pacrim,
    irongate, nova, blueridge, coastal, redwood,
    skyline, clearwater, terrafirm, firstmile, apex,
  ] = await Promise.all([
    prisma.tenant.create({ data: { name: 'Meridian Capital Group', email: 'leasing@meridiancapital.com', company: 'Meridian Capital Group', creditScore: 825, crmStatus: 'HIGH_VALUE' }}),
    prisma.tenant.create({ data: { name: 'CascadeMed Health Partners', email: 'realestate@cascademed.com', company: 'CascadeMed Health Partners', creditScore: 805 }}),
    prisma.tenant.create({ data: { name: 'Brightline Software Inc', email: 'facilities@brightline.io', company: 'Brightline Software Inc', creditScore: 818, crmStatus: 'HIGH_VALUE' }}),
    prisma.tenant.create({ data: { name: 'Summit Advisory Partners', email: 'admin@summitadvisory.com', company: 'Summit Advisory Partners', creditScore: 791, crmStatus: 'AT_RISK' }}),
    prisma.tenant.create({ data: { name: 'Pacific Rim Trade & Export', email: 'leasing@pacrimtrade.com', company: 'Pacific Rim Trade & Export', creditScore: 764, crmStatus: 'AT_RISK' }}),
    prisma.tenant.create({ data: { name: 'Iron Gate Manufacturing', email: 'ops@irongate.com', company: 'Iron Gate Manufacturing', creditScore: 778 }}),
    prisma.tenant.create({ data: { name: 'Nova Fitness Holdings', email: 'real-estate@novafitness.com', company: 'Nova Fitness Holdings', creditScore: 712, crmStatus: 'AT_RISK' }}),
    prisma.tenant.create({ data: { name: 'Blue Ridge Analytics', email: 'admin@blueridgeanalytics.com', company: 'Blue Ridge Analytics', creditScore: 802 }}),
    prisma.tenant.create({ data: { name: 'Coastal Underwriters Group', email: 'space@coastaluw.com', company: 'Coastal Underwriters Group', creditScore: 834 }}),
    prisma.tenant.create({ data: { name: 'Redwood Capital LLC', email: 'leasing@redwoodcap.com', company: 'Redwood Capital LLC', creditScore: 796 }}),
    prisma.tenant.create({ data: { name: 'Skyline Legal Partners', email: 'ops@skylinelegal.com', company: 'Skyline Legal Partners', creditScore: 821, crmStatus: 'AT_RISK' }}),
    prisma.tenant.create({ data: { name: 'Clearwater Pharma Corp', email: 'facilities@clearwaterpharma.com', company: 'Clearwater Pharma Corp', creditScore: 843 }}),
    prisma.tenant.create({ data: { name: 'TerraFirm Engineering', email: 'admin@terrafirm.com', company: 'TerraFirm Engineering', creditScore: 788 }}),
    prisma.tenant.create({ data: { name: 'First Mile Logistics', email: 'leasing@firstmilelogistics.com', company: 'First Mile Logistics', creditScore: 772 }}),
    prisma.tenant.create({ data: { name: 'Apex Data Services', email: 'facilities@apexdata.io', company: 'Apex Data Services', creditScore: 810, crmStatus: 'AT_RISK' }}),
  ]);
  console.log('✓ Tenants');

  // ── Leases ─────────────────────────────────────────────────────────────────
  const [
    lseBos1a, lseBos1b, lseBos1c, lseBos1d,
    lsePhx1a, lsePhx1b, lsePhx1c, lsePhx1d,
    lseAtl1a, lseAtl1b, lseAtl1c, lseAtl1d,
    lseNsh1a, lseNsh1b,
    lseDen1a, lseDen1b, lseDen1c,
    lseSjc1a, lseSjc1b,
    lseHou1a, lseHou1b, lseHou1c,
    lseChs1a, lseChs1b, lseChs1c,
  ] = await Promise.all([
    // ── Boston: Harbor Point Office Center ──
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-BOS-001-A', propertyId: bos.id, tenantId: meridian.id,
      unitNumber: 'Suite 800', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'LOW',
      startDate: subMonths(now, 14), endDate: addMonths(now, 22),
      baseRent: 44400, rentEscalation: 0.03, securityDeposit: 88800, sqft: 7400,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-BOS-001-B', propertyId: bos.id, tenantId: skyline.id,
      unitNumber: 'Suite 600', type: 'MODIFIED_GROSS', status: 'ACTIVE', renewalRisk: 'HIGH',
      startDate: subMonths(now, 30), endDate: addDays(now, 38),
      baseRent: 31200, rentEscalation: 0.025, securityDeposit: 62400, sqft: 5200,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-BOS-001-C', propertyId: bos.id, tenantId: blueridge.id,
      unitNumber: 'Suite 400', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'MEDIUM',
      startDate: subMonths(now, 18), endDate: addDays(now, 68),
      baseRent: 20400, rentEscalation: 0.03, sqft: 3400,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-BOS-001-D', propertyId: bos.id, tenantId: terrafirm.id,
      unitNumber: 'Suite 200', type: 'GROSS', status: 'EXPIRED', renewalRisk: 'LOW',
      startDate: subMonths(now, 36), endDate: subMonths(now, 3),
      baseRent: 13200, rentEscalation: 0.025, sqft: 2200,
    }}),
    // ── Phoenix: Sunbelt Industrial Park ──
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-PHX-001-A', propertyId: phx.id, tenantId: irongate.id,
      unitNumber: 'Bays A1–A4', type: 'NET', status: 'ACTIVE', renewalRisk: 'LOW',
      startDate: subMonths(now, 8), endDate: addMonths(now, 24),
      baseRent: 31200, rentEscalation: 0.03, securityDeposit: 62400, sqft: 48000,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-PHX-001-B', propertyId: phx.id, tenantId: firstmile.id,
      unitNumber: 'Bays B1–B4', type: 'NET', status: 'ACTIVE', renewalRisk: 'MEDIUM',
      startDate: subMonths(now, 16), endDate: addMonths(now, 8),
      baseRent: 37700, rentEscalation: 0.025, sqft: 58000,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-PHX-001-C', propertyId: phx.id, tenantId: pacrim.id,
      unitNumber: 'Bay C1–C2', type: 'NET', status: 'ACTIVE', renewalRisk: 'CRITICAL',
      startDate: subMonths(now, 36), endDate: addDays(now, 11),
      baseRent: 15600, rentEscalation: 0.02, sqft: 24000,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-PHX-001-D', propertyId: phx.id, tenantId: apex.id,
      unitNumber: 'Bay D1', type: 'NET', status: 'ACTIVE', renewalRisk: 'LOW',
      startDate: subMonths(now, 6), endDate: addMonths(now, 32),
      baseRent: 10400, rentEscalation: 0.03, sqft: 16000,
    }}),
    // ── Atlanta: Peachtree Corporate Plaza ──
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-ATL-001-A', propertyId: atl.id, tenantId: cascademed.id,
      unitNumber: 'Floors 15–17', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'LOW',
      startDate: subMonths(now, 12), endDate: addMonths(now, 28),
      baseRent: 67500, rentEscalation: 0.03, securityDeposit: 135000, sqft: 22500,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-ATL-001-B', propertyId: atl.id, tenantId: summit.id,
      unitNumber: 'Floor 12', type: 'MODIFIED_GROSS', status: 'ACTIVE', renewalRisk: 'CRITICAL',
      startDate: subMonths(now, 30), endDate: addDays(now, 21),
      baseRent: 27000, rentEscalation: 0.02, securityDeposit: 54000, sqft: 9000,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-ATL-001-C', propertyId: atl.id, tenantId: clearwater.id,
      unitNumber: 'Floor 14', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'MEDIUM',
      startDate: subMonths(now, 24), endDate: addDays(now, 74),
      baseRent: 28800, rentEscalation: 0.03, securityDeposit: 57600, sqft: 9600,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-ATL-001-D', propertyId: atl.id, tenantId: terrafirm.id,
      unitNumber: 'Floor 7', type: 'MODIFIED_GROSS', status: 'ACTIVE', renewalRisk: 'LOW',
      startDate: subMonths(now, 10), endDate: addMonths(now, 16),
      baseRent: 18600, rentEscalation: 0.025, sqft: 6200,
    }}),
    // ── Nashville: Lower Broadway Retail Block ──
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-NSH-001-A', propertyId: nsh.id, tenantId: nova.id,
      unitNumber: 'Units 100–104', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'HIGH',
      startDate: subMonths(now, 20), endDate: addDays(now, 44),
      baseRent: 23400, rentEscalation: 0.02, securityDeposit: 46800, sqft: 7800,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-NSH-001-B', propertyId: nsh.id, tenantId: redwood.id,
      unitNumber: 'Unit 200', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'LOW',
      startDate: subMonths(now, 5), endDate: addMonths(now, 19),
      baseRent: 7800, rentEscalation: 0.03, sqft: 2600,
    }}),
    // ── Denver: Cherry Creek Mixed-Use Center ──
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-DEN-001-A', propertyId: den.id, tenantId: coastal.id,
      unitNumber: 'Office 3F', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'LOW',
      startDate: subMonths(now, 9), endDate: addMonths(now, 21),
      baseRent: 16000, rentEscalation: 0.03, sqft: 4000,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-DEN-001-B', propertyId: den.id, tenantId: redwood.id,
      unitNumber: 'Office 4F', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'HIGH',
      startDate: subMonths(now, 28), endDate: addDays(now, 46),
      baseRent: 18400, rentEscalation: 0.025, securityDeposit: 36800, sqft: 4600,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-DEN-001-C', propertyId: den.id, tenantId: cascademed.id,
      unitNumber: 'Office 2F', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'LOW',
      startDate: subMonths(now, 7), endDate: addMonths(now, 14),
      baseRent: 12800, rentEscalation: 0.03, sqft: 3200,
    }}),
    // ── San Jose: North First Tech Campus ──
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-SJC-001-A', propertyId: sjc.id, tenantId: brightline.id,
      unitNumber: 'Buildings A & B', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'LOW',
      startDate: subMonths(now, 20), endDate: addMonths(now, 34),
      baseRent: 216000, rentEscalation: 0.03, securityDeposit: 432000, sqft: 54000,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-SJC-001-B', propertyId: sjc.id, tenantId: apex.id,
      unitNumber: 'Building C', type: 'NET', status: 'ACTIVE', renewalRisk: 'HIGH',
      startDate: subMonths(now, 14), endDate: addDays(now, 52),
      baseRent: 96000, rentEscalation: 0.025, sqft: 32000,
    }}),
    // ── Houston: Port Terminal Logistics Park ──
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-HOU-001-A', propertyId: hou.id, tenantId: firstmile.id,
      unitNumber: 'Warehouses 1–3', type: 'NET', status: 'ACTIVE', renewalRisk: 'LOW',
      startDate: subMonths(now, 10), endDate: addMonths(now, 20),
      baseRent: 54600, rentEscalation: 0.03, securityDeposit: 109200, sqft: 78000,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-HOU-001-B', propertyId: hou.id, tenantId: irongate.id,
      unitNumber: 'Warehouses 5–6', type: 'NET', status: 'ACTIVE', renewalRisk: 'MEDIUM',
      startDate: subMonths(now, 20), endDate: addDays(now, 82),
      baseRent: 36400, rentEscalation: 0.025, sqft: 52000,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-HOU-001-C', propertyId: hou.id, tenantId: pacrim.id,
      unitNumber: 'Warehouse 8', type: 'NET', status: 'ACTIVE', renewalRisk: 'LOW',
      startDate: subMonths(now, 4), endDate: addMonths(now, 26),
      baseRent: 26600, rentEscalation: 0.03, sqft: 38000,
    }}),
    // ── Charleston: King Street Retail Row ──
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-CHS-001-A', propertyId: chs.id, tenantId: nova.id,
      unitNumber: 'Units A1–A2', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'LOW',
      startDate: subMonths(now, 6), endDate: addMonths(now, 24),
      baseRent: 13600, rentEscalation: 0.02, sqft: 3400,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-CHS-001-B', propertyId: chs.id, tenantId: meridian.id,
      unitNumber: 'Unit B1', type: 'GROSS', status: 'RENEWED', renewalRisk: 'LOW',
      startDate: subMonths(now, 36), endDate: subMonths(now, 1),
      baseRent: 8800, rentEscalation: 0.025, sqft: 2200,
    }}),
    prisma.lease.create({ data: {
      leaseNumber: 'LSE-CHS-001-C', propertyId: chs.id, tenantId: redwood.id,
      unitNumber: 'Unit C1', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'MEDIUM',
      startDate: subMonths(now, 20), endDate: addDays(now, 66),
      baseRent: 6400, rentEscalation: 0.02, sqft: 1600,
    }}),
  ]);
  console.log('✓ Leases');

  // ── Financial Records ──────────────────────────────────────────────────────
  // months = how many months of history to generate (skips last month for leases with pending invoices)
  const leaseHistory: Array<{ lease: typeof lseBos1a; months: number }> = [
    { lease: lseBos1a, months: 12 },
    { lease: lseBos1b, months: 12 },
    { lease: lseBos1c, months: 12 },
    { lease: lseBos1d, months: 9 },   // expired 3mo ago
    { lease: lsePhx1a, months: 8 },   // started 8mo ago
    { lease: lsePhx1b, months: 12 },
    { lease: lsePhx1c, months: 11 },  // last month is overdue (added below)
    { lease: lsePhx1d, months: 6 },   // started 6mo ago
    { lease: lseAtl1a, months: 12 },
    { lease: lseAtl1b, months: 11 },  // last month is overdue (added below)
    { lease: lseAtl1c, months: 12 },
    { lease: lseAtl1d, months: 10 },  // started 10mo ago
    { lease: lseNsh1a, months: 11 },  // last month is overdue (added below)
    { lease: lseNsh1b, months: 5 },   // started 5mo ago
    { lease: lseDen1a, months: 9 },   // started 9mo ago
    { lease: lseDen1b, months: 12 },
    { lease: lseDen1c, months: 7 },   // started 7mo ago
    { lease: lseSjc1a, months: 12 },
    { lease: lseSjc1b, months: 12 },
    { lease: lseHou1a, months: 10 },  // started 10mo ago
    { lease: lseHou1b, months: 12 },
    { lease: lseHou1c, months: 4 },   // started 4mo ago
    { lease: lseChs1a, months: 6 },   // started 6mo ago
    { lease: lseChs1b, months: 12 },
    { lease: lseChs1c, months: 12 },
  ];

  const revenueRecords: object[] = [];
  for (const { lease, months } of leaseHistory) {
    for (let i = months; i >= 1; i--) {
      const periodStart = startOfMonth(subMonths(now, i));
      const periodEnd = endOfMonth(subMonths(now, i));
      const base = Number(lease.baseRent);
      const amount = Math.round(base * (1 + (Math.random() * 0.04 - 0.02)) * 100) / 100;
      revenueRecords.push({
        propertyId: lease.propertyId,
        leaseId: lease.id,
        type: 'REVENUE',
        status: 'RECONCILED',
        amount,
        periodStart,
        periodEnd,
        paidDate: new Date(periodStart.getTime() + 5 * 86400000),
        description: 'Monthly rent',
        category: 'RENT',
      });
    }
  }

  // Overdue invoices — PENDING with past dueDate (show in Work Queue)
  const overdueRecords: object[] = [
    {
      propertyId: lsePhx1c.propertyId,
      leaseId: lsePhx1c.id,
      type: 'REVENUE',
      status: 'PENDING',
      amount: 15600,
      periodStart: startOfMonth(subMonths(now, 1)),
      periodEnd: endOfMonth(subMonths(now, 1)),
      dueDate: subDays(now, 36),
      description: 'Monthly rent — overdue (tenant cash flow issue)',
      category: 'RENT',
    },
    {
      propertyId: lseAtl1b.propertyId,
      leaseId: lseAtl1b.id,
      type: 'REVENUE',
      status: 'PENDING',
      amount: 27000,
      periodStart: startOfMonth(subMonths(now, 1)),
      periodEnd: endOfMonth(subMonths(now, 1)),
      dueDate: subDays(now, 24),
      description: 'Monthly rent — awaiting payment',
      category: 'RENT',
    },
    {
      propertyId: lseNsh1a.propertyId,
      leaseId: lseNsh1a.id,
      type: 'REVENUE',
      status: 'PENDING',
      amount: 23400,
      periodStart: startOfMonth(subMonths(now, 1)),
      periodEnd: endOfMonth(subMonths(now, 1)),
      dueDate: subDays(now, 8),
      description: 'Monthly rent — partial dispute in progress',
      category: 'RENT',
    },
  ];

  // Operating & maintenance expenses per property — 12 months
  const expenseBase: Record<string, number> = {
    [bos.id]: 12000,
    [phx.id]: 18000,
    [atl.id]: 22000,
    [nsh.id]: 8500,
    [den.id]: 14000,
    [sjc.id]: 32000,
    [hou.id]: 21000,
    [chs.id]: 7000,
  };

  const expenseRecords: object[] = [];
  for (const property of [bos, phx, atl, nsh, den, sjc, hou, chs]) {
    const base = expenseBase[property.id];
    for (let i = 12; i >= 1; i--) {
      const periodStart = startOfMonth(subMonths(now, i));
      const periodEnd = endOfMonth(subMonths(now, i));
      expenseRecords.push({
        propertyId: property.id,
        type: 'EXPENSE',
        status: 'RECONCILED',
        amount: Math.round(base * (1 + (Math.random() * 0.3 - 0.15)) * 100) / 100,
        periodStart,
        periodEnd,
        description: 'Operating expenses',
        category: 'OPERATIONS',
      });
      if (i % 2 === 0) {
        expenseRecords.push({
          propertyId: property.id,
          type: 'EXPENSE',
          status: 'RECONCILED',
          amount: Math.round(base * 0.4 * (1 + (Math.random() * 0.4 - 0.2)) * 100) / 100,
          periodStart,
          periodEnd,
          description: 'Maintenance & repairs',
          category: 'MAINTENANCE',
        });
      }
    }
  }

  const allFinancial = [...revenueRecords, ...overdueRecords, ...expenseRecords];
  await prisma.financialRecord.createMany({ data: allFinancial as any });
  console.log(`✓ Financial records (${allFinancial.length} total)`);

  // ── Alerts ─────────────────────────────────────────────────────────────────
  await prisma.alert.createMany({
    data: [
      {
        type: 'LEASE_EXPIRATION',
        severity: 'CRITICAL',
        title: 'Lease expiring in 11 days — Pacific Rim Trade',
        description: 'LSE-PHX-001-C at Sunbelt Industrial expires June 17. Pacific Rim has not responded to renewal outreach. Active search for alternative space confirmed.',
        propertyId: lsePhx1c.propertyId,
        leaseId: lsePhx1c.id,
        createdById: admin.id,
        metadata: { daysLeft: 11, renewalRisk: 'CRITICAL', monthlyRisk: 15600 },
      },
      {
        type: 'LEASE_EXPIRATION',
        severity: 'CRITICAL',
        title: 'Lease expiring in 21 days — Summit Advisory',
        description: 'LSE-ATL-001-B at Peachtree Corporate Plaza expires June 27. Renewal negotiations have stalled. Tenant downsizing proposal unresolved.',
        propertyId: lseAtl1b.propertyId,
        leaseId: lseAtl1b.id,
        createdById: admin.id,
        metadata: { daysLeft: 21, renewalRisk: 'CRITICAL', monthlyRisk: 27000 },
      },
      {
        type: 'RENEWAL_RISK',
        severity: 'WARNING',
        title: 'No renewal response — Skyline Legal Partners (BOS)',
        description: 'LSE-BOS-001-B expires in 38 days. Three outreach attempts with no response. Tenant has been touring Back Bay alternatives.',
        propertyId: lseBos1b.propertyId,
        leaseId: lseBos1b.id,
        createdById: admin.id,
        metadata: { daysLeft: 38, renewalRisk: 'HIGH', monthlyRisk: 31200 },
      },
      {
        type: 'RENEWAL_RISK',
        severity: 'WARNING',
        title: 'Anchor tenant at risk — Apex Data Services (SJC)',
        description: 'LSE-SJC-001-B expires in 52 days. Apex is evaluating flex/co-working options. Vacancy would reduce North First Tech Campus occupancy by 33%.',
        propertyId: lseSjc1b.propertyId,
        leaseId: lseSjc1b.id,
        createdById: admin.id,
        metadata: { daysLeft: 52, renewalRisk: 'HIGH', monthlyRisk: 96000 },
      },
      {
        type: 'PAYMENT_ANOMALY',
        severity: 'WARNING',
        title: 'Overdue rent — Pacific Rim Trade (PHX)',
        description: 'May rent of $15,600 for LSE-PHX-001-C is 36 days past due. Tenant cites cash flow strain and is unlikely to cure before lease expiry.',
        propertyId: lsePhx1c.propertyId,
        leaseId: lsePhx1c.id,
        createdById: admin.id,
        metadata: { daysOverdue: 36, amountDue: 15600 },
      },
      {
        type: 'FINANCIAL_DISCREPANCY',
        severity: 'WARNING',
        title: 'Revenue gap — Cherry Creek Mixed-Use (Q1)',
        description: 'DEN-001 Q1 2026 revenue is $4,280 below projected based on lease terms. Likely a reconciliation timing issue — review recommended.',
        propertyId: den.id,
        createdById: admin.id,
        metadata: { discrepancy: 4280, period: 'Q1 2026', propertyCode: 'DEN-001' },
      },
      {
        type: 'OCCUPANCY_CHANGE',
        severity: 'INFO',
        title: '3 units vacant 45+ days — Nashville Retail',
        description: 'NSH-001 has 3 vacant retail units following the Blue Ridge Analytics and TerraFirm departures. No marketing campaign initiated.',
        propertyId: nsh.id,
        createdById: admin.id,
        metadata: { vacantUnits: 3, daysSinceVacant: 47 },
      },
      {
        type: 'LEASE_EXPIRATION',
        severity: 'INFO',
        title: 'Renewal window opening — Iron Gate Manufacturing (HOU)',
        description: 'LSE-HOU-001-B expires in 82 days. Renewal risk rated MEDIUM. Recommend initiating discussions within 30 days to retain this anchor industrial tenant.',
        propertyId: lseHou1b.propertyId,
        leaseId: lseHou1b.id,
        createdById: admin.id,
        metadata: { daysLeft: 82, renewalRisk: 'MEDIUM', monthlyRisk: 36400 },
      },
    ],
  });
  console.log('✓ Alerts');

  console.log('\n✅ Seed complete');
  console.log('\nPortfolio:');
  console.log('  8 properties  — Boston, Phoenix, Atlanta, Nashville, Denver, San Jose, Houston, Charleston');
  console.log('  15 tenants    — finance, tech, healthcare, industrial, retail, logistics');
  console.log('  25 leases     — 21 active, 1 expired, 1 renewed, 2 CRITICAL expiring');
  console.log(`  ${allFinancial.length} financial records — 12mo history, 3 overdue invoices`);
  console.log('  8 alerts      — 2 critical, 4 warning, 2 info');
  console.log('\nCredentials:');
  console.log('  admin@valence.dev   / Admin1234!');
  console.log('  analyst@valence.dev / Analyst1234!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
