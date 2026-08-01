import type { ComponentType } from 'react';
import {
  Building2, FileText, Users, UserCog, UserPlus, KeyRound,
} from 'lucide-react';

export const ACTION_META: Record<string, { label: string; color: string }> = {
  CREATE:          { label: 'Created',        color: 'text-success bg-success/10 border-success/20'          },
  UPDATE:          { label: 'Updated',        color: 'text-brand-300 bg-brand-600/10 border-brand-500/20'    },
  DELETE:          { label: 'Deleted',        color: 'text-danger bg-danger/10 border-danger/20'             },
  IMPORT:          { label: 'Imported',       color: 'text-amber-300 bg-amber-500/10 border-amber-500/20'    },
  PLAN_CHANGE:     { label: 'Plan change',    color: 'text-purple-300 bg-purple-500/10 border-purple-500/20' },
  ROLE_CHANGE:     { label: 'Role change',    color: 'text-sky-300 bg-sky-500/10 border-sky-500/20'          },
  RESTORE:         { label: 'Restored',       color: 'text-teal-300 bg-teal-500/10 border-teal-500/20'       },
  STAGE_CHANGE:    { label: 'Stage moved',    color: 'text-violet-300 bg-violet-500/10 border-violet-500/20' },
  INVITE:          { label: 'Invited',        color: 'text-teal-300 bg-teal-500/10 border-teal-500/20'       },
  INVITE_REVOKE:   { label: 'Invite revoked', color: 'text-slate-400 bg-surface-300/30 border-surface-400/20'},
  PASSWORD_CHANGE: { label: 'Password changed', color: 'text-sky-300 bg-sky-500/10 border-sky-500/20'        },
  EMAIL_CHANGE:    { label: 'Email changed',  color: 'text-sky-300 bg-sky-500/10 border-sky-500/20'          },
  MFA_ENABLED:     { label: 'MFA enabled',    color: 'text-success bg-success/10 border-success/20'          },
  MFA_DISABLED:    { label: 'MFA disabled',   color: 'text-warning bg-warning/10 border-warning/20'          },
  SESSION_REVOKE:  { label: 'Session revoked', color: 'text-danger bg-danger/10 border-danger/20'            },
  EXPORT:          { label: 'Exported',       color: 'text-amber-300 bg-amber-500/10 border-amber-500/20'    },
};

export const DEFAULT_ACTION_META = { label: 'Event', color: 'text-slate-400 bg-surface-300/30 border-surface-400/20' };

export const ENTITY_ICON: Record<string, ComponentType<{ className?: string }>> = {
  property: Building2,
  lease: FileText,
  tenant: Users,
  user: UserCog,
  invite: UserPlus,
  session: KeyRound,
};

export const DEFAULT_ENTITY_ICON = UserCog;
