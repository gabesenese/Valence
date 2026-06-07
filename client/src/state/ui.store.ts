import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AlertSeverityFilter = 'all' | 'warning' | 'critical';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  alertSeverityFilter: AlertSeverityFilter;
  setAlertSeverityFilter: (v: AlertSeverityFilter) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v: boolean) => set({ sidebarCollapsed: v }),
      alertSeverityFilter: 'all' as AlertSeverityFilter,
      setAlertSeverityFilter: (v: AlertSeverityFilter) => set({ alertSeverityFilter: v }),
    }),
    {
      name: 'valence-ui',
      partialize: (s: UIState) => ({ alertSeverityFilter: s.alertSeverityFilter }),
    },
  ),
);
