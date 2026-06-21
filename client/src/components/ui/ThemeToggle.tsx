import { Moon, Sun } from 'lucide-react';
import { useUIStore } from '@/state/ui.store';
import { resolveTheme } from '@/lib/theme';

export function ThemeToggle() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const resolved = resolveTheme(theme);
  const next = resolved === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="text-slate-500 transition-colors hover:text-slate-300"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {resolved === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
