import type { Request, Response, NextFunction } from 'express';
import type { Plan } from '@prisma/client';
import { meetsMinPlan, PLAN_ORDER } from '../modules/plans/plans.service';

export function resolveEffectivePlan(plan: Plan, trialEndsAt: string | null): Plan {
  if (trialEndsAt && new Date(trialEndsAt) > new Date()) {
    if (PLAN_ORDER[plan] < PLAN_ORDER['PROFESSIONAL']) return 'PROFESSIONAL';
  }
  return plan;
}

export function planGate(required: Plan) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rawPlan = (req.user?.plan) ?? 'FREE';
    const trialEndsAt = req.user?.trialEndsAt ?? null;
    const effective = resolveEffectivePlan(rawPlan, trialEndsAt);
    if (meetsMinPlan(effective, required)) return next();
    res.status(402).json({
      error: 'Plan upgrade required',
      requiredPlan: required,
      currentPlan: rawPlan,
      message: `This feature requires the ${required} plan or higher.`,
    });
  };
}
