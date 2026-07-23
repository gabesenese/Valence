import { prisma } from '../../infrastructure/database';
import { env } from '../../config/env';
import { MockAIProvider } from './providers/mock.provider';
import type { AIProvider, InsightEngine, RiskEvaluator, GeneratedInsight, RiskEvaluation } from './ai.interfaces';

function createProvider(): AIProvider {
  switch (env.AI_PROVIDER) {
    case 'mock':
    default:
      return new MockAIProvider();
  }
}

const provider = createProvider();

export const insightEngine: InsightEngine = {
  async analyzePortfolio(): Promise<GeneratedInsight[]> {
    const insight = await provider.generateInsight({ type: 'portfolio', data: {} });
    return [insight];
  },

  async analyzeProperty(propertyId: string): Promise<GeneratedInsight[]> {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: { _count: { select: { leases: { where: { deletedAt: null } } } } },
    });

    const insight = await provider.generateInsight({
      type: 'property',
      data: { propertyId, totalLeases: property?._count.leases ?? 0 },
    });

    return [insight];
  },

  async analyzeLease(leaseId: string): Promise<GeneratedInsight[]> {
    const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
    const daysUntilExpiry = lease
      ? Math.ceil((lease.endDate.getTime() - Date.now()) / 86400000)
      : 180;

    const insight = await provider.generateInsight({
      type: 'lease',
      data: { leaseId, daysUntilExpiry },
    });

    return [insight];
  },
};

export const riskEvaluator: RiskEvaluator = {
  async evaluateLeaseRisk(leaseId: string): Promise<RiskEvaluation> {
    const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
    const daysUntilExpiry = lease
      ? Math.ceil((lease.endDate.getTime() - Date.now()) / 86400000)
      : 180;

    return provider.evaluateRisk({ type: 'lease', data: { leaseId, daysUntilExpiry } });
  },

  async evaluatePortfolioRisk(): Promise<RiskEvaluation> {
    return provider.evaluateRisk({ type: 'portfolio', data: {} });
  },
};

export { provider as aiProvider };
