import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/utils/cn';

const LINKS = [
  { label: 'Product',  href: '#product' },
  { label: 'Pricing',  href: '/pricing' },
  { label: 'Security', href: '/security' },
  { label: 'FAQ',      href: '#faq' },
];

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  const className = 'text-sm text-slate-400 transition-colors duration-200 hover:text-fg';
  if (href.startsWith('#')) {
    return <a href={href} onClick={onClick} className={className}>{label}</a>;
  }
  return <Link to={href} onClick={onClick} className={className}>{label}</Link>;
}

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        scrolled ? 'border-b border-surface-400 bg-surface-0/80 backdrop-blur-xl' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[70rem] items-center justify-between gap-6 px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Valence home">
          <Logo className="h-7 w-5" />
          <span className="text-[0.9375rem] font-semibold tracking-tight text-fg">Valence</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => <NavLink key={l.label} {...l} />)}
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            to="/auth/login"
            className="hidden text-sm text-slate-400 transition-colors duration-200 hover:text-fg sm:block"
          >
            Sign in
          </Link>
          <Link
            to="/auth/register"
            className="hidden rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-500 sm:block"
          >
            Start free trial
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            className="text-slate-400 transition-colors duration-200 hover:text-fg md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="landing-mobile-menu" className="border-t border-surface-400 bg-surface-0/95 backdrop-blur-xl md:hidden">
          <nav className="mx-auto flex max-w-[70rem] flex-col gap-4 px-6 py-5">
            {LINKS.map((l) => <NavLink key={l.label} {...l} onClick={() => setOpen(false)} />)}
            <NavLink href="/auth/login" label="Sign in" onClick={() => setOpen(false)} />
            <Link
              to="/auth/register"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-brand-600 px-3.5 py-2 text-center text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-500"
            >
              Start free trial
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
