import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, FileText, Building2, BarChart3, Bell, DollarSign,
  LogOut, ChevronLeft, Cpu, Users, Settings, Inbox, Layers,
  Wand2, ClipboardList, Heart, FolderOpen, Zap, Lock, Upload, ScrollText, Download,
  UserX, Sparkles, HelpCircle, Trash2, Database, Menu, X,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { setOrgCurrency } from '@/utils/format';
import { organizationService } from '@/services/organization.service';
import { useAuthStore } from '@/state/auth.store';
import { useUIStore } from '@/state/ui.store';
import { authService } from '@/services/auth.service';
import { usePlan, PLAN_LABELS } from '@/hooks/usePlan';
import { TrialBanner } from '@/components/ui/TrialBanner';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { EmailVerificationBanner } from '@/components/ui/EmailVerificationBanner';

type NavItem = {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  exact?: boolean;
  feature?: string;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Operations',
    items: [
      { to: '/queue',      icon: Inbox,         label: 'Work Queue',  exact: true, feature: 'work_queue' },
      { to: '/tasks',      icon: ClipboardList, label: 'Tasks',                    feature: 'tasks'      },
      { to: '/leases',     icon: FileText,      label: 'Leases'                                          },
      { to: '/properties', icon: Building2,     label: 'Properties'                                      },
      { to: '/tenants',    icon: Users,         label: 'Tenants'                                         },
      { to: '/crm',        icon: Heart,         label: 'CRM',                      feature: 'crm'        },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard'                                          },
      { to: '/finance',    icon: DollarSign,      label: 'Finance'                                            },
      { to: '/analytics',  icon: BarChart3,       label: 'Analytics'                                          },
      { to: '/benchmarks', icon: Layers,          label: 'Performance', feature: 'performance'                },
    ],
  },
  {
    label: 'Planning',
    items: [
      { to: '/simulator',  icon: Wand2, label: 'Impact Analysis', feature: 'impact_analysis' },
      { to: '/automation', icon: Zap,   label: 'Automation',      feature: 'automation'      },
      { to: '/alerts',     icon: Bell,  label: 'Alerts'                                       },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/documents', icon: FolderOpen,  label: 'Documents', feature: 'documents' },
      { to: '/import',    icon: Upload,      label: 'Import Data'                      },
      { to: '/audit',     icon: ScrollText,  label: 'Audit Log'                        },
      { to: '/organization', icon: Building2,   label: 'Organization'                   },
      { to: '/export',       icon: Download,   label: 'Export'                         },
      { to: '/trash',        icon: Trash2,     label: 'Trash'                          },
      { to: '/backups',      icon: Database,   label: 'Backups'                        },
      { to: '/settings',     icon: Settings,   label: 'Account'                        },
      { to: '/support',      icon: HelpCircle, label: 'Support'                        },
    ],
  },
];

export function AppLayout() {
  const user              = useAuthStore((s) => s.user);
  const refreshToken      = useAuthStore((s) => s.refreshToken);
  const logout            = useAuthStore((s) => s.logout);
  const isImpersonating   = useAuthStore((s) => s.isImpersonating);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);
  const originalSession   = useAuthStore((s) => s.originalSession);
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccess, requiredPlan, label: planLabel } = usePlan();

  const isCollapsed = sidebarCollapsed && !mobileNavOpen;

  const closeMobileNav = useCallback((restoreFocus = false) => {
    setMobileNavOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
    }
  }, []);

  function handleExitImpersonation() {
    stopImpersonation();
    navigate('/admin');
  }

  const { data: org } = useQuery({
    queryKey: ['organization'],
    queryFn: organizationService.getOrganization,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (org?.currency) setOrgCurrency(org.currency);
  }, [org?.currency]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileNav(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeMobileNav, mobileNavOpen]);

  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', mobileNavOpen);
    return () => document.body.classList.remove('overflow-hidden');
  }, [mobileNavOpen]);

  const handleLogout = async () => {
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } finally {
      logout();
      navigate('/auth/login');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => closeMobileNav(true)}
          role="presentation"
        />
      )}
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col border-r border-surface-400/40 bg-surface-50 transition-transform duration-200 lg:static lg:z-auto',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          sidebarCollapsed ? 'lg:w-[60px]' : 'lg:w-[220px]',
        )}
      >
        {/* Logo */}
        <div className={cn('flex h-14 items-center border-b border-surface-400/40 px-4', isCollapsed && 'justify-center px-0')}>
          <div className="flex flex-1 items-center gap-2.5">
            <img src="/logo.svg" alt="Valence" className="h-8 w-5 shrink-0" />
            {!isCollapsed && (
              <span className="text-sm font-bold tracking-tight text-white">Valence</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => closeMobileNav(true)}
            className="text-slate-500 transition-colors hover:text-slate-300 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="flex flex-col gap-0">
            {NAV_SECTIONS.map((section, si) => (
              <li key={section.label}>
                {/* Section header — hidden when collapsed */}
                {!isCollapsed && (
                  <p className={cn(
                    'px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600',
                    si === 0 ? 'pb-1 pt-1' : 'pb-1 pt-4',
                  )}>
                    {section.label}
                  </p>
                )}

                {/* Collapsed spacer between sections */}
                {isCollapsed && si > 0 && (
                  <div className="my-2 mx-3 border-t border-surface-400/20" />
                )}

                <ul className="flex flex-col gap-0.5">
                  {section.items.map(({ to, icon: Icon, label, exact, feature }) => {
                    const locked = feature ? !canAccess(feature) : false;
                    const needed = feature ? requiredPlan(feature) : null;

                    if (locked) {
                      return (
                        <li key={to}>
                          <button
                            type="button"
                            onClick={() => {
                              closeMobileNav();
                              navigate('/pricing');
                            }}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-100 text-slate-600 hover:bg-surface-200/50 hover:text-slate-500',
                              isCollapsed && 'justify-center px-0 py-2.5',
                            )}
                            title={isCollapsed ? `${label} — ${needed ? PLAN_LABELS[needed] : ''} plan` : undefined}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {!isCollapsed && (
                              <>
                                <span className="flex-1 text-left">{label}</span>
                                <Lock className="h-3 w-3 shrink-0 text-slate-700" />
                              </>
                            )}
                          </button>
                        </li>
                      );
                    }

                    return (
                      <li key={to}>
                        <NavLink
                          to={to}
                          end={exact}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-100',
                              isActive
                                ? 'bg-brand-600/20 text-brand-300 shadow-inner'
                                : 'text-slate-500 hover:bg-surface-200 hover:text-slate-200',
                              isCollapsed && 'justify-center px-0 py-2.5',
                            )
                          }
                          onClick={() => closeMobileNav()}
                          title={isCollapsed ? label : undefined}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {!isCollapsed && label}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        {/* User footer */}
        <div className="border-t border-surface-400/40 p-2">
          {!isCollapsed && user && (
            <div className="mb-2 rounded-lg px-3 py-2">
              <p className="truncate text-xs font-medium text-slate-300">{user.firstName} {user.lastName}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[10px] text-slate-600">{user.role}</span>
                <span className="text-slate-700">·</span>
                <button
                  type="button"
                  onClick={() => {
                    closeMobileNav();
                    navigate('/pricing');
                  }}
                  className="text-[10px] font-semibold text-brand-400/80 hover:text-brand-300 transition-colors"
                >
                  {planLabel}
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-danger/10 hover:text-danger',
              isCollapsed && 'justify-center px-0 py-2.5',
            )}
            title="Sign out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && 'Sign out'}
          </button>
        </div>

        {/* Collapse toggle — desktop only */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute -right-3 top-[70px] z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-surface-400/60 bg-surface-100 text-slate-500 shadow-card transition-colors hover:border-brand-500/40 hover:text-brand-400 lg:flex"
        >
          <ChevronLeft className={cn('h-3 w-3 transition-transform duration-200', sidebarCollapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-surface-400/40 bg-surface-50 px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              ref={mobileMenuButtonRef}
              onClick={() => setMobileNavOpen(true)}
              className="text-slate-500 transition-colors hover:text-slate-300 lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Cpu className="h-4 w-4 text-brand-400" />
            <span className="hidden text-xs text-slate-600 sm:inline">Operational Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden items-center gap-2 sm:flex">
              <div className="h-2 w-2 animate-pulse-slow rounded-full bg-success" />
              <span className="text-xs text-slate-600">Live</span>
            </div>
          </div>
        </header>

        {isImpersonating && (
          <div className="flex flex-col gap-2 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <UserX className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="min-w-0 text-xs font-medium text-amber-300">
                Impersonating <span className="font-bold">{user?.firstName} {user?.lastName}</span> ({user?.email})
              </span>
              {originalSession && (
                <span className="hidden text-[11px] text-amber-500/70 sm:inline">— logged in as {originalSession.user.email}</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleExitImpersonation}
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
              Exit impersonation
            </button>
          </div>
        )}
        {user?.isDemo && (
          <div className="flex flex-col gap-2 border-b border-brand-500/30 bg-brand-600/10 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-brand-400 shrink-0" />
              <span className="text-xs font-medium text-brand-300">
                You're exploring a demo portfolio — data resets automatically after 2 hours.
              </span>
            </div>
            <Link
              to="/auth/register"
              className="rounded-lg border border-brand-500/40 bg-brand-600/20 px-3 py-1 text-xs font-semibold text-brand-300 hover:bg-brand-600/30 transition-colors whitespace-nowrap"
            >
              Start free trial →
            </Link>
          </div>
        )}
        <EmailVerificationBanner />
        <TrialBanner />

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
