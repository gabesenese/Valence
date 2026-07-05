/*
 * Seeds a realistic THIN-DATA trial account: ~6 active leases across 2 small
 * properties, with rent (baseRent) but NO financial-record/expense history and
 * no QuickBooks — the shape a GTA PM firm arrives with on day one (#164).
 *
 * Use it to check that every revenue-derived surface (Overview health/priorities,
 * Forecast, Revenue-at-risk, Benchmarks) is meaningful on leases alone, and that
 * Expenses/Profitability show purposeful empty states rather than zeros.
 *
 * Idempotent: upserts the user and wipes their existing portfolio before seeding.
 * Login: thin@valence.dev / (TESTER_PASSWORD env, default below).
 *
 * Do NOT add thin@valence.dev to TESTER_EMAILS — login resets a tester's
 * portfolio (see auth.service login), which would wipe this fixture on sign-in.
 * It's already kept out of MRR via the @valence.dev domain in admin analytics.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../infrastructure/database';
import { DemoPortfolioFactory } from '../modules/demo/demo.factory';

const EMAIL = 'thin@valence.dev';
const PASSWORD = process.env.TESTER_PASSWORD ?? 'ValenceTester!2026';

const add = (base: Date, days: number) => new Date(base.getTime() + days * 86_400_000);
const months = (base: Date, n: number) => {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d;
};

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { role: 'ADMIN', plan: 'PROFESSIONAL', isActive: true, emailVerifiedAt: new Date(), passwordHash },
    create: {
      email: EMAIL,
      passwordHash,
      firstName: 'Thin',
      lastName: 'Trial',
      role: 'ADMIN',
      plan: 'PROFESSIONAL',
      emailVerifiedAt: new Date(),
    },
  });

  await new DemoPortfolioFactory().reset(user.id);

  const now = new Date();
  const userId = user.id;
  const lnum = (n: number) => `THIN-${userId.slice(0, 8).toUpperCase()}-${String(n).padStart(3, '0')}`;

  const result = await prisma.$transaction(async (tx) => {
    const [oakwood, dundas] = await Promise.all([
      tx.property.create({ data: {
        ownerId: userId, name: 'Oakwood Court', code: 'OAK', type: 'RESIDENTIAL', status: 'ACTIVE',
        address: '58 Oakwood Court', city: 'Mississauga', state: 'ON', zipCode: 'L5B 1M2',
        totalUnits: 4, totalSqft: 6400,
      }}),
      tx.property.create({ data: {
        ownerId: userId, name: 'Dundas Storefronts', code: 'DUN', type: 'RETAIL', status: 'ACTIVE',
        address: '212 Dundas Street W', city: 'Toronto', state: 'ON', zipCode: 'M5T 1G8',
        totalUnits: 3, totalSqft: 5200,
      }}),
    ]);

    const tenants = await Promise.all([
      tx.tenant.create({ data: { ownerId: userId, name: 'Northline Bookkeeping', email: 'hello@northline.ca', company: 'Northline Bookkeeping', creditScore: 740, crmStatus: 'ACTIVE' } }),
      tx.tenant.create({ data: { ownerId: userId, name: 'Rosa & Sons Grocery', email: 'orders@rosasons.ca', company: 'Rosa & Sons Grocery', creditScore: 690, crmStatus: 'ACTIVE' } }),
      tx.tenant.create({ data: { ownerId: userId, name: 'Beacon Dental', email: 'front@beacondental.ca', company: 'Beacon Dental', creditScore: 780, crmStatus: 'HIGH_VALUE' } }),
      tx.tenant.create({ data: { ownerId: userId, name: 'Clover Yoga Studio', email: 'studio@cloveryoga.ca', company: 'Clover Yoga Studio', creditScore: 660, crmStatus: 'AT_RISK' } }),
      tx.tenant.create({ data: { ownerId: userId, name: 'Maple Leaf Printing', email: 'jobs@mapleleafprint.ca', company: 'Maple Leaf Printing', creditScore: 710, crmStatus: 'ACTIVE' } }),
      tx.tenant.create({ data: { ownerId: userId, name: 'Harbour Coffee Co.', email: 'hi@harbourcoffee.ca', company: 'Harbour Coffee Co.', creditScore: 700, crmStatus: 'ACTIVE' } }),
    ]);

    await Promise.all([
      tx.lease.create({ data: { leaseNumber: lnum(1), propertyId: oakwood.id, tenantId: tenants[0].id, unitNumber: 'Unit 1', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'LOW', startDate: months(now, -14), endDate: months(now, 22), baseRent: 3_200, rentEscalation: 0.03, securityDeposit: 6_400, sqft: 1500, renewalStage: 'NOT_STARTED' } }),
      tx.lease.create({ data: { leaseNumber: lnum(2), propertyId: oakwood.id, tenantId: tenants[2].id, unitNumber: 'Unit 2', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'MEDIUM', startDate: months(now, -20), endDate: months(now, 4), baseRent: 4_100, rentEscalation: 0.025, securityDeposit: 8_200, sqft: 1700, renewalStage: 'CONTACTED', lastContactedAt: add(now, -12) } }),
      tx.lease.create({ data: { leaseNumber: lnum(3), propertyId: oakwood.id, tenantId: tenants[3].id, unitNumber: 'Unit 3', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'HIGH', startDate: months(now, -33), endDate: add(now, 52), baseRent: 2_900, rentEscalation: 0.02, securityDeposit: 5_800, sqft: 1400, renewalStage: 'NEGOTIATING', lastContactedAt: add(now, -6) } }),
      tx.lease.create({ data: { leaseNumber: lnum(4), propertyId: dundas.id, tenantId: tenants[1].id, unitNumber: 'Store A', type: 'NET', status: 'ACTIVE', renewalRisk: 'CRITICAL', startDate: months(now, -46), endDate: add(now, 34), baseRent: 6_800, rentEscalation: 0.025, securityDeposit: 13_600, sqft: 2100, renewalStage: 'CONTACTED', lastContactedAt: add(now, -4) } }),
      tx.lease.create({ data: { leaseNumber: lnum(5), propertyId: dundas.id, tenantId: tenants[4].id, unitNumber: 'Store B', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'LOW', startDate: months(now, -9), endDate: months(now, 27), baseRent: 5_400, rentEscalation: 0.03, securityDeposit: 10_800, sqft: 1800, renewalStage: 'NOT_STARTED' } }),
      tx.lease.create({ data: { leaseNumber: lnum(6), propertyId: dundas.id, tenantId: tenants[5].id, unitNumber: 'Store C', type: 'GROSS', status: 'ACTIVE', renewalRisk: 'MEDIUM', startDate: months(now, -6), endDate: months(now, 30), baseRent: 4_600, rentEscalation: 0.03, securityDeposit: 9_200, sqft: 1300, renewalStage: 'NOT_STARTED' } }),
    ]);

    return { properties: 2, tenants: tenants.length, leases: 6 };
  }, { timeout: 30_000 });

  const monthlyRent = 3_200 + 4_100 + 2_900 + 6_800 + 5_400 + 4_600;
  console.log(`✓ Thin account ready: ${user.email} (id ${user.id})`);
  console.log(`  ${result.properties} properties · ${result.tenants} tenants · ${result.leases} active leases · $${monthlyRent.toLocaleString()}/mo contract rent · 0 financial records`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
