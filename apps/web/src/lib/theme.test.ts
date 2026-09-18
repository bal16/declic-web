import { describe, expect, it } from 'bun:test';

import {
  getToggledTheme,
  getThemeScript,
  isShortcutBlockedTarget,
  matchesThemeShortcut,
  parseStoredTheme,
  readStoredTheme,
  resolveTheme,
} from './theme';

function keyEvent(overrides = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    key: 'd',
    metaKey: false,
    repeat: false,
    shiftKey: true,
    ...overrides,
  };
}

describe('theme shortcut (Shift+D)', () => {
  it('matches Shift+D in either case', () => {
    expect(matchesThemeShortcut(keyEvent())).toBe(true);
    expect(matchesThemeShortcut(keyEvent({ key: 'D' }))).toBe(true);
  });

  it('rejects plain D and modified/repeated presses', () => {
    expect(matchesThemeShortcut(keyEvent({ shiftKey: false }))).toBe(false);
    expect(matchesThemeShortcut(keyEvent({ ctrlKey: true }))).toBe(false);
    expect(matchesThemeShortcut(keyEvent({ metaKey: true }))).toBe(false);
    expect(matchesThemeShortcut(keyEvent({ altKey: true }))).toBe(false);
    expect(matchesThemeShortcut(keyEvent({ repeat: true }))).toBe(false);
    expect(matchesThemeShortcut(keyEvent({ key: 'e' }))).toBe(false);
  });

  it('blocks editable targets so typing capital D is safe', () => {
    const input = {
      closest: (sel: string) => (sel.includes('input') ? {} : null),
    };
    expect(isShortcutBlockedTarget(input)).toBe(true);
    expect(
      isShortcutBlockedTarget({
        closest: (sel: string) => (sel.includes('menuitem') ? {} : null),
      }),
    ).toBe(true);
    expect(isShortcutBlockedTarget({ closest: () => null })).toBe(false);
    expect(isShortcutBlockedTarget(null)).toBe(false);
  });
});

describe('theme resolution (dark-first)', () => {
  it('resolves system against the OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('toggles the resolved theme', () => {
    expect(getToggledTheme('dark', false)).toBe('light');
    expect(getToggledTheme('light', false)).toBe('dark');
    expect(getToggledTheme('system', true)).toBe('light');
    expect(getToggledTheme('system', false)).toBe('dark');
  });

  it('falls back to dark for unknown stored values', () => {
    expect(parseStoredTheme('light', 'dark')).toBe('light');
    expect(parseStoredTheme('nonsense', 'dark')).toBe('dark');
  });

  it('readStoredTheme falls back when the store throws', () => {
    const throwing = () => {
      throw new Error('denied');
    };
    expect(readStoredTheme(() => 'light', 'k', 'dark')).toBe('light');
    expect(readStoredTheme(() => 'nonsense', 'k', 'dark')).toBe('dark');
    expect(readStoredTheme(throwing, 'k', 'dark')).toBe('dark');
  });

  it('emits a pre-hydration script with the dark fallback', () => {
    const script = getThemeScript('declic-theme', 'dark');
    expect(script).toContain('declic-theme');
    expect(script).toContain('"dark"');
    expect(script).toContain('colorScheme');
  });
});
