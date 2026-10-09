import { mock } from 'bun:test';

// `<ScriptOnce>` needs a TanStack router context and renders `null` on the
// client anyway, so stub it to keep these tests focused on theme behavior.
// (SSR script emission is covered by the `getThemeScript` unit test.)
void mock.module('@tanstack/react-router', () => ({
  ScriptOnce: () => null,
}));

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { THEME_STORAGE_KEY } from '@/lib/theme';

import { stubMatchMedia } from '../../test/setup';

function Probe() {
  const { setTheme } = useTheme();
  return (
    <div>
      <button type="button" onClick={() => setTheme('light')}>
        to-light
      </button>
      <button type="button" onClick={() => setTheme('system')}>
        to-system
      </button>
    </div>
  );
}

function rootClasses(): string[] {
  return [...document.documentElement.classList];
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
});

describe('ThemeProvider', () => {
  it('defaults to dark-first with empty storage', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(rootClasses()).toContain('dark');
    expect(rootClasses()).not.toContain('light');
  });

  it('restores the persisted theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(rootClasses()).toContain('light');
    expect(rootClasses()).not.toContain('dark');
  });

  it('falls back to dark for unknown stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'nonsense');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(rootClasses()).toContain('dark');
  });

  it('setTheme updates the class and persists', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'to-light' }));
    expect(rootClasses()).toContain('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('system resolves against the OS preference', () => {
    stubMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    const { unmount } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(rootClasses()).toContain('dark');
    unmount();

    stubMatchMedia(false);
    localStorage.clear();
    document.documentElement.className = '';
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'to-system' }));
    expect(rootClasses()).toContain('light');
  });
});
