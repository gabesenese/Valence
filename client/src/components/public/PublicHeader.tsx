import { Link } from 'react-router-dom';
import { AboutMenu } from './AboutMenu';
import { Logo } from '@/components/ui/Logo';

export function PublicHeader() {
  return (
    <header className="relative z-20 border-b border-surface-400/20 bg-surface-0/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo className="h-9 w-6" />
          <span className="text-sm font-bold tracking-tight text-fg">Valence</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/pricing" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Pricing</Link>
          <AboutMenu />
          <Link to="/auth/login" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Sign in</Link>
        </nav>

        <Link
          to="/auth/register"
          className="text-sm font-medium text-slate-300 hover:text-fg transition-colors"
        >
          Get started
        </Link>
      </div>
    </header>
  );
}
