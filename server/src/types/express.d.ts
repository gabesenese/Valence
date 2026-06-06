import type { UserRole, Plan } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        plan: Plan;
        firstName: string;
        lastName: string;
      };
    }
  }
}

export {};
