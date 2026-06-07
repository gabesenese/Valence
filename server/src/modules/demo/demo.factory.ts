import { prisma } from '../../infrastructure/database';

const add = (base: Date, days: number) => new Date(base.getTime() + days * 86_400_000);
const months = (base: Date, n: number) => {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d;
};

export class DemoPortfolioFactory {
  async reset() {
    await prisma.task.deleteMany({});
    await prisma.alert.deleteMany({});      // cascades AlertActivity
    await prisma.insight.deleteMany({});
    await prisma.financialRecord.deleteMany({});
    await prisma.contactLog.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.lease.deleteMany({});       // cascades LeaseActivity, LeaseNote
    await prisma.tenant.deleteMany({});
    await prisma.property.deleteMany({});
  }

  async create(userId: string) {
    await this.reset();

    const now = new Date();

    return prisma.$transaction(async (tx) => {
      // ── Properties ─────────────────────────────────────────────────────────────
      const [maple, king, riverside] = await Promise.all([
        tx.property.create({ data: {
          name: 'Maple Towers',
          code: 'MAPLE',
          type: 'RESIDENTIAL',
          status: 'ACTIVE',
          address: '142 Maple Avenue',
          city: 'Boston',
          state: 'MA',
          zipCode: '02101',
          totalUnits: 24,
          totalSqft: 48000,
          yearBuilt: 1998,
          purchasePrice: 8_400_000,
          currentValue: 10_200_000,
        }}),
        tx.property.create({ data: {
          name: 'King Street Centre',
          code: 'KING',
          type: 'RETAIL',
          status: 'ACTIVE',
          address: '89 King Street',
          city: 'Denver',
          state: 'CO',
          zipCode: '80202',
          totalUnits: 8,
          totalSqft: 22000,
          yearBuilt: 2005,
          purchasePrice: 3_800_000,
          currentValue: 4_600_000,
        }}),
        tx.property.create({ data: {
          name: 'Riverside Plaza',
          code: 'RIVER',
          type: 'MIXED_USE',
          status: 'ACTIVE',
          address: '301 Riverside Drive',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          totalUnits: 12,
          totalSqft: 35000,
          yearBuilt: 2011,
          purchasePrice: 5_600_000,
          currentValue: 7_100_000,
        }}),
      ]);

      // ── Tenants ────────────────────────────────────────────────────────────────
      const [meridian, peak, harbor, sunrise, westside, coretech, brighthorizon, axiom, metro, pacific] =
        await Promise.all([
          tx.tenant.create({ data: { name: 'Meridian Analytics Group',   email: 'leasing@meridiananalytics.com',   company: 'Meridian Analytics Group',   creditScore: 820, crmStatus: 'HIGH_VALUE' } }),
          tx.tenant.create({ data: { name: 'Peak Solutions LLC',         email: 'info@peaksolutions.com',          company: 'Peak Solutions LLC',         creditScore: 765, crmStatus: 'ACTIVE'     } }),
          tx.tenant.create({ data: { name: 'Harbor Medical Partners',    email: 'leasing@harbormed.com',           company: 'Harbor Medical Partners',    creditScore: 798, crmStatus: 'HIGH_VALUE' } }),
          tx.tenant.create({ data: { name: 'Sunrise Retail Co.',         email: 'retail@sunriseco.com',            company: 'Sunrise Retail Co.',         creditScore: 680, crmStatus: 'AT_RISK'    } }),
          tx.tenant.create({ data: { name: 'Westside Legal Associates',  email: 'admin@westsidelegal.com',         company: 'Westside Legal Associates',  creditScore: 750, crmStatus: 'ACTIVE'     } }),
          tx.tenant.create({ data: { name: 'CoreTech Systems',           email: 'facilities@coretech.io',          company: 'CoreTech Systems',           creditScore: 810, crmStatus: 'ACTIVE'     } }),
          tx.tenant.create({ data: { name: 'Bright Horizon Café',        email: 'ops@brighthorizoncafe.com',       company: 'Bright Horizon Café',        creditScore: 650, crmStatus: 'AT_RISK'    } }),
          tx.tenant.create({ data: { name: 'Axiom Capital Group',        email: 'leasing@axiomcapital.com',        company: 'Axiom Capital Group',        creditScore: 835, crmStatus: 'HIGH_VALUE' } }),
          tx.tenant.create({ data: { name: 'Metro Community Health',     email: 'admin@metrocommunityhealth.org',  company: 'Metro Community Health',     creditScore: 775, crmStatus: 'ACTIVE'     } }),
          tx.tenant.create({ data: { name: 'Pacific Trade Ventures',     email: 'leasing@pacifictrade.com',        company: 'Pacific Trade Ventures',     creditScore: 790, crmStatus: 'ACTIVE'     } }),
        ]);

      // ── Leases (15) ────────────────────────────────────────────────────────────
      const leases = await Promise.all([
        // MAPLE TOWERS (6)
        tx.lease.create({ data: { leaseNumber: 'DEMO-001', propertyId: maple.id,    tenantId: meridian.id,     unitNumber: 'Suite 1A', type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'LOW',      startDate: months(now, -18), endDate: months(now, 24),  baseRent: 8_500,  rentEscalation: 0.03,  securityDeposit: 17_000, sqft: 2200, renewalStage: 'NOT_STARTED' } }),
        tx.lease.create({ data: { leaseNumber: 'DEMO-002', propertyId: maple.id,    tenantId: peak.id,         unitNumber: 'Suite 2B', type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'MEDIUM',   startDate: months(now, -16), endDate: months(now, 8),   baseRent: 6_200,  rentEscalation: 0.025, securityDeposit: 12_400, sqft: 1600, renewalStage: 'CONTACTED',   lastContactedAt: add(now, -14) } }),
        tx.lease.create({ data: { leaseNumber: 'DEMO-003', propertyId: maple.id,    tenantId: harbor.id,       unitNumber: 'Suite 3C', type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'LOW',      startDate: months(now, -6),  endDate: months(now, 36),  baseRent: 9_800,  rentEscalation: 0.03,  securityDeposit: 19_600, sqft: 2800, renewalStage: 'NOT_STARTED' } }),
        tx.lease.create({ data: { leaseNumber: 'DEMO-004', propertyId: maple.id,    tenantId: westside.id,     unitNumber: 'Suite 4D', type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'HIGH',     startDate: months(now, -47), endDate: add(now, 45),     baseRent: 7_400,  rentEscalation: 0.02,  securityDeposit: 14_800, sqft: 1900, renewalStage: 'NEGOTIATING', lastContactedAt: add(now, -7)  } }),
        tx.lease.create({ data: { leaseNumber: 'DEMO-005', propertyId: maple.id,    tenantId: coretech.id,     unitNumber: 'Suite 5E', type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'LOW',      startDate: months(now, -6),  endDate: months(now, 18),  baseRent: 5_800,  rentEscalation: 0.03,  securityDeposit: 11_600, sqft: 1500, renewalStage: 'NOT_STARTED' } }),
        tx.lease.create({ data: { leaseNumber: 'DEMO-006', propertyId: maple.id,    tenantId: metro.id,        unitNumber: 'Suite 6F', type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'MEDIUM',   startDate: months(now, -18), endDate: months(now, 6),   baseRent: 6_500,  rentEscalation: 0.02,  securityDeposit: 13_000, sqft: 1700, renewalStage: 'CONTACTED',   lastContactedAt: add(now, -21) } }),
        // KING STREET CENTRE (4)
        tx.lease.create({ data: { leaseNumber: 'DEMO-007', propertyId: king.id,     tenantId: sunrise.id,      unitNumber: 'Unit 101', type: 'NET',   status: 'ACTIVE',   renewalRisk: 'CRITICAL', startDate: months(now, -59), endDate: add(now, 30),     baseRent: 12_000, rentEscalation: 0.025, securityDeposit: 24_000, sqft: 3200, renewalStage: 'NEGOTIATING', lastContactedAt: add(now, -3)  } }),
        tx.lease.create({ data: { leaseNumber: 'DEMO-008', propertyId: king.id,     tenantId: brighthorizon.id,unitNumber: 'Unit 102', type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'HIGH',     startDate: months(now, -23), endDate: add(now, 90),     baseRent: 4_800,  rentEscalation: 0.02,  securityDeposit: 9_600,  sqft: 1200, renewalStage: 'CONTACTED',   lastContactedAt: add(now, -10) } }),
        tx.lease.create({ data: { leaseNumber: 'DEMO-009', propertyId: king.id,     tenantId: axiom.id,        unitNumber: 'Unit 201', type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'LOW',      startDate: months(now, -12), endDate: months(now, 30),  baseRent: 18_000, rentEscalation: 0.03,  securityDeposit: 36_000, sqft: 4800, renewalStage: 'NOT_STARTED' } }),
        tx.lease.create({ data: { leaseNumber: 'DEMO-010', propertyId: king.id,     tenantId: pacific.id,      unitNumber: 'Unit 202', type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'LOW',      startDate: months(now, -6),  endDate: months(now, 48),  baseRent: 15_500, rentEscalation: 0.03,  securityDeposit: 31_000, sqft: 4200, renewalStage: 'NOT_STARTED' } }),
        // RIVERSIDE PLAZA (5)
        tx.lease.create({ data: { leaseNumber: 'DEMO-011', propertyId: riverside.id,tenantId: meridian.id,     unitNumber: 'Suite A',  type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'LOW',      startDate: months(now, -10), endDate: months(now, 22),  baseRent: 11_000, rentEscalation: 0.03,  securityDeposit: 22_000, sqft: 2900, renewalStage: 'NOT_STARTED' } }),
        tx.lease.create({ data: { leaseNumber: 'DEMO-012', propertyId: riverside.id,tenantId: peak.id,         unitNumber: 'Suite B',  type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'MEDIUM',   startDate: months(now, -19), endDate: months(now, 5),   baseRent: 8_800,  rentEscalation: 0.02,  securityDeposit: 17_600, sqft: 2300, renewalStage: 'CONTACTED',   lastContactedAt: add(now, -28) } }),
        tx.lease.create({ data: { leaseNumber: 'DEMO-013', propertyId: riverside.id,tenantId: coretech.id,     unitNumber: 'Suite C',  type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'LOW',      startDate: months(now, -8),  endDate: months(now, 26),  baseRent: 7_200,  rentEscalation: 0.03,  securityDeposit: 14_400, sqft: 1900, renewalStage: 'NOT_STARTED' } }),
        tx.lease.create({ data: { leaseNumber: 'DEMO-014', propertyId: riverside.id,tenantId: harbor.id,       unitNumber: 'Suite D',  type: 'GROSS', status: 'ACTIVE',   renewalRisk: 'LOW',      startDate: months(now, -4),  endDate: months(now, 36),  baseRent: 13_500, rentEscalation: 0.03,  securityDeposit: 27_000, sqft: 3600, renewalStage: 'NOT_STARTED' } }),
        tx.lease.create({ data: { leaseNumber: 'DEMO-015', propertyId: riverside.id,tenantId: axiom.id,        unitNumber: 'Suite E',  type: 'GROSS', status: 'EXPIRED',  renewalRisk: 'LOW',      startDate: months(now, -48), endDate: months(now, -12), baseRent: 9_000,  rentEscalation: 0.02,  securityDeposit: 18_000, sqft: 2400, renewalStage: 'NOT_STARTED' } }),
      ]);

      const westsideLease    = leases[3];  // DEMO-004 — expires in 45 days
      const sunriseLease     = leases[6];  // DEMO-007 — expires in 30 days, CRITICAL
      const brightHorizonLease = leases[7]; // DEMO-008 — HIGH risk, 90 days

      // ── Financial Records ──────────────────────────────────────────────────────
      // 6 months of reconciled revenue per property + bi-monthly expenses
      const propRevenue = [
        { prop: maple,    monthly: 44_200 },
        { prop: king,     monthly: 50_300 },
        { prop: riverside,monthly: 40_500 },
      ];

      const finRecords = propRevenue.flatMap(({ prop, monthly }) =>
        Array.from({ length: 6 }, (_, i) => {
          const pStart = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          const pEnd   = new Date(now.getFullYear(), now.getMonth() - (4 - i), 0);
          const records = [
            tx.financialRecord.create({ data: {
              propertyId: prop.id,
              type: 'REVENUE',
              status: 'RECONCILED',
              amount: monthly,
              category: 'RENT',
              periodStart: pStart,
              periodEnd: pEnd,
              paidDate: add(pStart, 3),
              description: `Rent collection · ${pStart.toLocaleString('default', { month: 'short', year: 'numeric' })}`,
            }}),
          ];
          if (i % 2 === 0) {
            records.push(tx.financialRecord.create({ data: {
              propertyId: prop.id,
              type: 'EXPENSE',
              status: 'RECONCILED',
              amount: Math.round(monthly * 0.28),
              category: 'OPERATIONS',
              periodStart: pStart,
              periodEnd: add(pEnd, 62),
              description: `Operating expenses · ${pStart.toLocaleString('default', { month: 'short', year: 'numeric' })}`,
            }}));
          }
          return records;
        }).flat()
      );

      // Two overdue / flagged records for Work Queue demo
      const overdueRecords = [
        tx.financialRecord.create({ data: {
          propertyId: king.id,
          leaseId: sunriseLease.id,
          type: 'REVENUE',
          status: 'PENDING',
          amount: 12_000,
          category: 'RENT',
          periodStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          periodEnd:   new Date(now.getFullYear(), now.getMonth(), 0),
          dueDate: add(now, -15),
          description: 'Monthly rent · Sunrise Retail Co. (OVERDUE)',
        }}),
        tx.financialRecord.create({ data: {
          propertyId: maple.id,
          leaseId: westsideLease.id,
          type: 'REVENUE',
          status: 'FLAGGED',
          amount: 7_400,
          category: 'RENT',
          periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
          periodEnd:   new Date(now.getFullYear(), now.getMonth() + 1, 0),
          dueDate: add(now, -3),
          description: 'Monthly rent · Westside Legal Associates (FLAGGED)',
        }}),
      ];

      await Promise.all([...finRecords, ...overdueRecords]);

      // ── Alerts (5) ─────────────────────────────────────────────────────────────
      const [alert1, alert2, alert3, , alert5] = await Promise.all([
        tx.alert.create({ data: {
          type: 'LEASE_EXPIRATION',
          severity: 'CRITICAL',
          status: 'OPEN',
          title: 'Lease Expiring: Sunrise Retail Co.',
          description: 'Lease for Unit 101 at King Street Centre expires in 30 days. Tenant has not confirmed renewal.',
          propertyId: king.id,
          leaseId: sunriseLease.id,
          createdById: userId,
        }}),
        tx.alert.create({ data: {
          type: 'RENEWAL_RISK',
          severity: 'CRITICAL',
          status: 'OPEN',
          title: 'Critical Renewal Risk: Westside Legal',
          description: 'Westside Legal Associates lease at Maple Towers Suite 4D expires in 45 days with high renewal risk.',
          propertyId: maple.id,
          leaseId: westsideLease.id,
          createdById: userId,
        }}),
        tx.alert.create({ data: {
          type: 'PAYMENT_ANOMALY',
          severity: 'WARNING',
          status: 'OPEN',
          title: 'Overdue Payment: Bright Horizon Café',
          description: 'Rent payment from Bright Horizon Café at King Street Unit 102 is 15 days overdue.',
          propertyId: king.id,
          leaseId: brightHorizonLease.id,
          createdById: userId,
        }}),
        tx.alert.create({ data: {
          type: 'OCCUPANCY_CHANGE',
          severity: 'INFO',
          status: 'OPEN',
          title: 'Occupancy Below Target: King Street Centre',
          description: 'King Street Centre occupancy is at 75%, below the 90% portfolio target. Suite E vacancy requires backfill.',
          propertyId: king.id,
          createdById: userId,
        }}),
        tx.alert.create({ data: {
          type: 'FINANCIAL_DISCREPANCY',
          severity: 'WARNING',
          status: 'OPEN',
          title: 'Revenue Discrepancy: Riverside Plaza',
          description: 'Riverside Plaza reported revenue is 8.3% below projection this month. Review financial records.',
          propertyId: riverside.id,
          createdById: userId,
        }}),
      ]);

      // ── Tasks (5) ──────────────────────────────────────────────────────────────
      await Promise.all([
        tx.task.create({ data: {
          title: 'Contact Westside Legal about lease renewal',
          description: 'Reach out to schedule a renewal discussion. Lease expires in 45 days with HIGH risk rating.',
          status: 'OPEN',
          leaseId: westsideLease.id,
          propertyId: maple.id,
          alertId: alert2.id,
          createdById: userId,
          dueAt: add(now, 7),
        }}),
        tx.task.create({ data: {
          title: 'Schedule renewal meeting: Sunrise Retail Co.',
          description: 'Critical: Unit 101 at King Street expires in 30 days. Confirm renewal or begin backfill immediately.',
          status: 'IN_PROGRESS',
          leaseId: sunriseLease.id,
          propertyId: king.id,
          alertId: alert1.id,
          createdById: userId,
          dueAt: add(now, 3),
        }}),
        tx.task.create({ data: {
          title: 'Investigate revenue decline at Riverside Plaza',
          description: 'Revenue is 8.3% below projection. Pull financial records and identify the source of discrepancy.',
          status: 'OPEN',
          propertyId: riverside.id,
          alertId: alert5.id,
          createdById: userId,
          dueAt: add(now, 5),
        }}),
        tx.task.create({ data: {
          title: 'Follow up on overdue payment: Bright Horizon Café',
          description: 'Rent 15 days overdue. Send formal notice and escalate if unpaid within 5 business days.',
          status: 'OPEN',
          leaseId: brightHorizonLease.id,
          propertyId: king.id,
          alertId: alert3.id,
          createdById: userId,
          dueAt: add(now, 2),
        }}),
        tx.task.create({ data: {
          title: 'Evaluate backfill strategy for Riverside Suite E',
          description: 'Suite E has been vacant for 12 months. Assess market conditions and prepare a leasing proposal.',
          status: 'OPEN',
          propertyId: riverside.id,
          createdById: userId,
          dueAt: add(now, 14),
        }}),
      ]);

      return {
        properties: 3,
        tenants: 10,
        leases: 15,
        alerts: 5,
        tasks: 5,
      };
    }, { timeout: 30_000 });
  }
}
