import { describe, it, expect, afterEach } from 'vitest';
import { useUIStore } from './ui.store';

afterEach(() => {
  useUIStore.getState().setTheme('dark');
});

describe('ui store theme', () => {
  it('defaults to dark', () => {
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('updates and persists via setTheme', () => {
    useUIStore.getState().setTheme('light');
    expect(useUIStore.getState().theme).toBe('light');

    useUIStore.getState().setTheme('system');
    expect(useUIStore.getState().theme).toBe('system');

    const persisted = JSON.parse(localStorage.getItem('valence-ui') ?? '{}');
    expect(persisted.state.theme).toBe('system');
  });
});
