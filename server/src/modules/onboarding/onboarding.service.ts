import { prisma } from '../../infrastructure/database';

export interface Milestone {
  id: string;
  label: string;
  description: string;
  done: boolean;
  href: string | null;
  cta: string | null;
}

export interface OnboardingProgress {
  milestones: Milestone[];
  completed: number;
  total: number;
  percent: number;
  allDone: boolean;
}

export async function getOnboardingProgress(userId: string): Promise<OnboardingProgress> {
  const [propertyCount, leaseCount, financialCount, documentCount] = await Promise.all([
    prisma.property.count({ where: { ownerId: userId } }),
    prisma.lease.count({ where: { property: { ownerId: userId } } }),
    prisma.financialRecord.count({ where: { property: { ownerId: userId } } }),
    prisma.document.count({ where: { uploadedById: userId } }),
  ]);

  const milestones: Milestone[] = [
    {
      id: 'account_created',
      label: 'Create your account',
      description: "You're in. Welcome to Valence.",
      done: true,
      href: null,
      cta: null,
    },
    {
      id: 'first_property',
      label: 'Add your first property',
      description: 'Your portfolio starts here.',
      done: propertyCount > 0,
      href: '/properties',
      cta: 'Add property',
    },
    {
      id: 'first_lease',
      label: 'Add your first lease',
      description: 'Import or create a lease to activate monitoring.',
      done: leaseCount > 0,
      href: '/import',
      cta: 'Import leases',
    },
    {
      id: 'financial_data',
      label: 'Log financial data',
      description: 'Connect revenue and expenses to unlock analytics.',
      done: financialCount > 0,
      href: '/finance',
      cta: 'Go to Finance',
    },
    {
      id: 'document_uploaded',
      label: 'Upload a contract',
      description: 'Store lease documents for AI contract intelligence.',
      done: documentCount > 0,
      href: '/documents',
      cta: 'Upload document',
    },
  ];

  const completed = milestones.filter((m) => m.done).length;
  const total = milestones.length;
  const percent = Math.round((completed / total) * 100);

  return { milestones, completed, total, percent, allDone: completed === total };
}
