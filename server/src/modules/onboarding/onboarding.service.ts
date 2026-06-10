import { prisma } from '../../infrastructure/database';

export interface Milestone {
  id: string;
  label: string;
  description: string;
  done: boolean;
  optional?: boolean;
  href: string | null;
  cta: string | null;
}

export interface OnboardingProgress {
  milestones: Milestone[];
  completed: number;
  total: number;
  percent: number;
  allDone: boolean;
  counts: {
    properties: number;
    leases: number;
    invites: number;
  };
}

export async function getOnboardingProgress(userId: string): Promise<OnboardingProgress> {
  const [user, propertyCount, leaseCount, alertCount, inviteCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isDemo: true } }),
    prisma.property.count({ where: { ownerId: userId } }),
    prisma.lease.count({ where: { property: { ownerId: userId } } }),
    prisma.alert.count({ where: { property: { ownerId: userId } } }),
    prisma.invite.count({ where: { invitedById: userId } }),
  ]);

  const milestones: Milestone[] = [
    {
      id: 'data_loaded',
      label: 'Load demo portfolio or import real data',
      description: 'Explore with sample data or bring your own portfolio.',
      done: (user?.isDemo ?? false) || propertyCount > 0 || leaseCount > 0,
      href: '/import',
      cta: 'Import data',
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
      id: 'reviewed_queue',
      label: 'Review your Work Queue',
      description: 'See what Valence has flagged across your portfolio.',
      done: alertCount > 0,
      href: '/queue',
      cta: 'Open Work Queue',
    },
    {
      id: 'team_member',
      label: 'Invite a team member',
      description: 'Give your team visibility into the portfolio.',
      done: inviteCount > 0,
      optional: true,
      href: '/team',
      cta: 'Invite someone',
    },
  ];

  const required = milestones.filter((m) => !m.optional);
  const completed = required.filter((m) => m.done).length;
  const total = required.length;
  const percent = Math.round((completed / total) * 100);

  return {
    milestones,
    completed,
    total,
    percent,
    allDone: completed === total,
    counts: { properties: propertyCount, leases: leaseCount, invites: inviteCount },
  };
}
