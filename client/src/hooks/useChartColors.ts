import { useUIStore } from '@/state/ui.store';
import { resolveTheme } from '@/lib/theme';

export interface ChartColors {
  brand: string;
  success: string;
  danger: string;
  warning: string;
  orange: string;
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipLabel: string;
}

const DARK: ChartColors = {
  brand: '#6366f1',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  orange: '#f97316',
  grid: '#1e1e3a',
  axis: '#475569',
  tooltipBg: '#13131e',
  tooltipBorder: '#252540',
  tooltipText: '#e2e8f0',
  tooltipLabel: '#94a3b8',
};

const LIGHT: ChartColors = {
  brand: '#6366f1',
  success: '#34c759',
  danger: '#ff3b30',
  warning: '#ff9500',
  orange: '#ff9500',
  grid: '#e5e5ea',
  axis: '#6e6e73',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e5e5ea',
  tooltipText: '#1d1d1f',
  tooltipLabel: '#6e6e73',
};

export function useChartColors(): ChartColors {
  const theme = useUIStore((s) => s.theme);
  return resolveTheme(theme) === 'dark' ? DARK : LIGHT;
}
