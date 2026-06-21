import { Compass, ScrollText, Database, ShieldCheck } from 'lucide-react';

export interface AboutLink {
  to: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ABOUT_LINKS: AboutLink[] = [
  {
    to: '/mission',
    label: 'Mission & Story',
    description: 'Why we built Valence and where it\'s going',
    icon: Compass,
  },
  {
    to: '/privacy',
    label: 'Privacy & Terms',
    description: 'How we collect, use, and protect your data',
    icon: ScrollText,
  },
  {
    to: '/data-controls',
    label: 'Data Controls',
    description: 'Export, retention, and deletion — your data, your call',
    icon: Database,
  },
  {
    to: '/security',
    label: 'Security',
    description: 'How we keep your portfolio safe',
    icon: ShieldCheck,
  },
];
