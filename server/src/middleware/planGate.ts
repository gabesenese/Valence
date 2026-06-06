import type { Request, Response, NextFunction } from 'express';
import type { Plan } from '@prisma/client';
import { meetsMinPlan } from '../modules/plans/plans.service';

export function planGate(required: Plan) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const plan = (req.user as { plan?: Plan }).plan ?? 'ESSENTIALS';
    if (meetsMinPlan(plan, required)) return next();
    res.status(402).json({
      error: 'Plan upgrade required',
      requiredPlan: required,
      currentPlan: plan,
      message: `This feature requires the ${required} plan or higher.`,
    });
  };
}
