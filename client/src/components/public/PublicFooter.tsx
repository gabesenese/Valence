import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { ABOUT_LINKS } from './aboutLinks';

export function PublicFooter() {
  return (
    <footer className="relative z-10 border-t border-surface-400/20 py-10">
      <div className="mx-auto max-w-6xl px-6 flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
            <Activity className="h-3.5 w-3.5 text-fg" />
          </div>
          <span className="text-sm font-semibold text-fg">Valence</span>
          <span className="text-xs text-slate-600 ml-1">Commercial Real Estate Operating System</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <Link to="/pricing" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Pricing</Link>
          {ABOUT_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
              {l.label}
            </Link>
          ))}
          <Link to="/auth/login" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Sign in</Link>
          <Link to="/auth/register" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Start Free Trial</Link>
        </div>
      </div>
    </footer>
  );
}
