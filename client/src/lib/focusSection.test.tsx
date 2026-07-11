import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useFocusTarget } from './focusSection';

function Probe({ name }: { name: string }) {
  const ref = useFocusTarget<HTMLDivElement>(name);
  return <div ref={ref} data-testid="target">content</div>;
}

describe('useFocusTarget', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('scrolls to and highlights the target when ?focus matches its name', () => {
    render(<MemoryRouter initialEntries={['/x?focus=occupancy']}><Probe name="occupancy" /></MemoryRouter>);
    const el = screen.getByTestId('target');
    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(el.hasAttribute('data-focus-active')).toBe(true);
  });

  it('does not fire for a non-matching focus value', () => {
    render(<MemoryRouter initialEntries={['/x?focus=revenue']}><Probe name="occupancy" /></MemoryRouter>);
    const el = screen.getByTestId('target');
    expect(el.scrollIntoView).not.toHaveBeenCalled();
    expect(el.hasAttribute('data-focus-active')).toBe(false);
  });

  it('no-ops when there is no focus param', () => {
    render(<MemoryRouter initialEntries={['/x']}><Probe name="occupancy" /></MemoryRouter>);
    expect(screen.getByTestId('target').hasAttribute('data-focus-active')).toBe(false);
  });
});
