import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Building2,
  BarChart3,
  Bell,
  DollarSign,
  LogOut,
  ChevronLeft,
  Activity,
  Cpu,
  Users,
  Settings,
  Inbox,
  Layers,
  Wand2,
  ClipboardList,
  Heart,
  FolderOpen,
  Zap,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/state/auth.store';
import { useUIStore } from '@/state/ui.store';
import { authService } from '@/services/auth.service';

const navItems = [
  { to: '/', icon: Inbox, label: 'Work Queue', exact: true },
  { to: '/tasks', icon: ClipboardList, label: 'Tasks' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leases', icon: FileText, label: 'Leases' },
  { to: '/properties', icon: Building2, label: 'Properties' },
  { to: '/tenants', icon: Users, label: 'Tenants' },
  { to: '/crm', icon: Heart, label: 'CRM' },
  { to: '/documents', icon: FolderOpen, label: 'Documents' },
  { to: '/finance', icon: DollarSign, label: 'Finance' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/benchmarks', icon: Layers, label: 'Performance' },
  { to: '/simulator', icon: Wand2, label: 'Impact Analysis' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/automation', icon: Zap, label: 'Automation' },
  { to: '/team', icon: Users, label: 'Team' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const navigate = useNavigate();

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
      {/* Sidebar */}
      <aside
        className={cn(
          'relative flex flex-col border-r border-surface-400/40 bg-surface-50 transition-all duration-200',
          sidebarCollapsed ? 'w-[60px]' : 'w-[220px]'
        )}
      >
        {/* Logo */}
        <div className={cn('flex h-14 items-center border-b border-surface-400/40 px-4', sidebarCollapsed && 'justify-center px-0')}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 shadow-glow-brand shrink-0">
              <Activity className="h-4 w-4 text-white" />
            </div>
            {!sidebarCollapsed && (
              <span className="text-sm font-bold tracking-tight text-white">Valence</span>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="flex flex-col gap-0.5">
            {navItems.map(({ to, icon: Icon, label, exact }) => (
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
                      sidebarCollapsed && 'justify-center px-0 py-2.5'
                    )
                  }
                  title={sidebarCollapsed ? label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User */}
        <div className="border-t border-surface-400/40 p-2">
          {!sidebarCollapsed && user && (
            <div className="mb-2 rounded-lg px-3 py-2">
              <p className="truncate text-xs font-medium text-slate-300">{user.firstName} {user.lastName}</p>
              <p className="truncate text-xs text-slate-500">{user.role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-danger/10 hover:text-danger',
              sidebarCollapsed && 'justify-center px-0 py-2.5'
            )}
            title="Sign out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && 'Sign out'}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-[70px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-surface-400/60 bg-surface-100 text-slate-500 shadow-card transition-colors hover:border-brand-500/40 hover:text-brand-400"
        >
          <ChevronLeft className={cn('h-3 w-3 transition-transform duration-200', sidebarCollapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 items-center justify-between border-b border-surface-400/40 bg-surface-50/50 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-brand-400" />
            <span className="text-xs text-slate-600">Operational Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse-slow rounded-full bg-success" />
            <span className="text-xs text-slate-600">Live</span>
          </div>
        </header>

        {/* Page */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
