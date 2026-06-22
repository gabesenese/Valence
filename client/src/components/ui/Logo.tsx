import { cn } from '@/utils/cn';

/**
 * Theme-aware Valence mark. logo.svg is white (for dark backgrounds) and
 * logo-dark.svg is black (for light backgrounds); we swap them on the `.dark`
 * class so the mark never blends into the page in either theme.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <>
      <img src="/logo-dark.svg" alt="Valence" className={cn('block dark:hidden', className)} />
      <img src="/logo.svg" alt="Valence" className={cn('hidden dark:block', className)} />
    </>
  );
}
