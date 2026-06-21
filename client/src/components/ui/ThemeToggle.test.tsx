import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ThemeToggle } from './ThemeToggle';
import { useUIStore } from '@/state/ui.store';

describe('ThemeToggle', () => {
  beforeEach(() => {
    useUIStore.getState().setTheme('dark');
  });

  it('renders an accessible toggle with no a11y violations', async () => {
    const { container } = render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('switches from dark to light on click', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(useUIStore.getState().theme).toBe('light');
  });
});
