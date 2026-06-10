import { api, extractData } from './api';

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

export const onboardingService = {
  getProgress: () => api.get('/onboarding/progress').then(extractData<OnboardingProgress>),
};
