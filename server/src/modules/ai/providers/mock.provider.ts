import type {
  AIProvider,
  InsightContext,
  GeneratedInsight,
  RiskEvaluation,
  AnomalyDetectionResult,
} from '../ai.interfaces';

export class MockAIProvider implements AIProvider {
  async generateInsight(context: InsightContext): Promise<GeneratedInsight> {
    const insights: Record<string, GeneratedInsight> = {
      lease: {
        title: 'Lease Portfolio Risk Concentration',
        summary: 'Elevated renewal risk detected in the 60-90 day window across portfolio.',
        body: {
          findings: ['23% of leases expire within 90 days', 'Renewal conversion rate trending below baseline'],
          recommendations: ['Initiate renewal outreach for high-risk leases', 'Review market rate positioning'],
        },
        confidence: 0.82,
        category: 'LEASE',
      },
      finance: {
        title: 'Revenue Variance Alert',
        summary: 'Month-over-month revenue variance exceeds statistical control limits.',
        body: {
          variance: '+4.2%',
          drivers: ['Increased occupancy in commercial segment', 'Escalation clauses activated'],
          risk: 'Sustaining elevated revenue may require market rate validation',
        },
        confidence: 0.91,
        category: 'FINANCIAL',
      },
      property: {
        title: 'Property Operational Intelligence',
        summary: 'Occupancy optimization opportunity identified.',
        body: {
          currentOccupancy: '87%',
          targetOccupancy: '95%',
          actions: ['Accelerate lease-up for vacant units', 'Review pricing strategy'],
        },
        confidence: 0.78,
        category: 'OPERATIONAL',
      },
      portfolio: {
        title: 'Portfolio Health Assessment',
        summary: 'Overall portfolio demonstrating stable performance with targeted risk pockets.',
        body: {
          healthScore: 78,
          keyMetrics: { occupancy: '89%', noi: '$2.1M', renewalRisk: 'MEDIUM' },
          priorities: ['Lease renewal pipeline', 'Financial reconciliation backlog'],
        },
        confidence: 0.85,
        category: 'RISK',
      },
    };

    return insights[context.type] ?? insights['portfolio'];
  }

  async evaluateRisk(context: InsightContext): Promise<RiskEvaluation> {
    const data = context.data as Record<string, unknown>;
    const daysLeft = (data.daysUntilExpiry as number) ?? 180;

    if (daysLeft <= 30) {
      return {
        score: 92,
        level: 'CRITICAL',
        factors: ['Imminent lease expiration', 'No renewal indication', 'Market volatility'],
        recommendation: 'Immediate outreach required. Prepare contingency for vacancy.',
      };
    }
    if (daysLeft <= 60) {
      return {
        score: 72,
        level: 'HIGH',
        factors: ['Lease expiring within 60 days', 'Renewal not confirmed'],
        recommendation: 'Schedule renewal negotiation meeting. Assess market rates.',
      };
    }
    if (daysLeft <= 90) {
      return {
        score: 48,
        level: 'MEDIUM',
        factors: ['Lease expiring within 90 days'],
        recommendation: 'Begin renewal outreach process.',
      };
    }

    return {
      score: 15,
      level: 'LOW',
      factors: ['Lease has substantial time remaining'],
      recommendation: 'Monitor per standard cadence.',
    };
  }

  async detectAnomalies(timeSeries: number[]): Promise<AnomalyDetectionResult> {
    if (timeSeries.length < 3) {
      return { detected: false, anomalies: [] };
    }

    const mean = timeSeries.reduce((a, b) => a + b, 0) / timeSeries.length;
    const variance = timeSeries.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / timeSeries.length;
    const stdDev = Math.sqrt(variance);

    const anomalies = timeSeries
      .map((val, idx) => {
        const deviation = Math.abs(val - mean) / (stdDev || 1);
        return { idx, val, deviation };
      })
      .filter((a) => a.deviation > 2)
      .map(({ idx, val, deviation }) => ({
        field: `period_${idx}`,
        expected: mean,
        actual: val,
        deviation,
        severity: (deviation > 3 ? 'high' : deviation > 2.5 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
      }));

    return { detected: anomalies.length > 0, anomalies };
  }
}
