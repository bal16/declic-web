import { mock } from 'bun:test';

// Same stub as theme-provider.test.tsx: `<ScriptOnce>` needs router
// context and renders `null` on the client.
void mock.module('@tanstack/react-router', () => ({
  ScriptOnce: () => null,
}));

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ModeToggle } from '@/components/mode-toggle';
import { ThemeProvider } from '@/components/theme-provider';
import { THEME_STORAGE_KEY } from '@/lib/theme';

import { stubMatchMedia } from '../../test/setup';

function rootClasses(): string[] {
  return [...document.documentElement.classList];
}

function setup() {
  return render(
    <ThemeProvider>
      <ModeToggle />
    </ThemeProvider>,
  );
}

async function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
  await screen.findByRole('menuitem', { name: 'Light' });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
});

describe('ModeToggle', () => {
  it('opens Light/Dark/System with the ⇧D hint', async () => {
    setup();
    await openMenu();
    expect(screen.getByRole('menuitem', { name: 'Light' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: /Dark/ })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'System' })).not.toBeNull();
    expect(screen.getByText('⇧D')).not.toBeNull();
  });

  it('menu selection switches theme and persists', async () => {
    setup();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Light' }));
    expect(rootClasses()).toContain('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'System' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('Shift+D toggles the resolved theme', () => {
    setup();
    expect(rootClasses()).toContain('dark');
    fireEvent.keyDown(document.body, { key: 'D', shiftKey: true });
    expect(rootClasses()).toContain('light');
    fireEvent.keyDown(document.body, { key: 'd', shiftKey: true });
    expect(rootClasses()).toContain('dark');
  });

  it('ignores plain D, repeat, and modified presses', () => {
    setup();
    const presses = [
      { key: 'd', shiftKey: false },
      { key: 'e', shiftKey: true },
      { key: 'D', shiftKey: true, repeat: true },
      { key: 'D', shiftKey: true, ctrlKey: true },
      { key: 'D', shiftKey: true, metaKey: true },
    ];
    for (const init of presses) {
      fireEvent.keyDown(document.body, init);
    }
    expect(rootClasses()).toContain('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('never toggles while typing capital D in an input', () => {
    render(
      <ThemeProvider>
        <label htmlFor="q">Search</label>
        <input id="q" />
        <ModeToggle />
      </ThemeProvider>,
    );
    const input = screen.getByLabelText('Search');
    fireEvent.keyDown(input, { key: 'D', shiftKey: true });
    expect(rootClasses()).toContain('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});
