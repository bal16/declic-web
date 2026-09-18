export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'declic-theme';
export const DEFAULT_THEME: Theme = 'dark';

/** Elements where typing must never trigger the theme shortcut. */
export const EDITABLE_SELECTOR =
  'input,textarea,select,[contenteditable="true"]';

type ShortcutKey = Pick<
  KeyboardEvent,
  'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'repeat' | 'shiftKey'
>;

/**
 * Pure predicate for the global theme shortcut: Shift+D.
 * DOM-free so it is unit-testable with `bun test`.
 */
export function matchesThemeShortcut(event: ShortcutKey): boolean {
  if (event.key.toLowerCase() !== 'd') return false;
  if (!event.shiftKey) return false;
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat)
    return false;
  return true;
}

type ClosestElement = {
  closest: (selector: string) => unknown;
};

/**
 * True when the keydown target lives inside an editable element or an
 * open menu — in both cases Shift+D must not toggle the theme
 * (typing capital "D", or Base UI menu typeahead).
 */
export function isShortcutBlockedTarget(target: unknown): boolean {
  if (
    target !== null &&
    typeof target === 'object' &&
    'closest' in target &&
    typeof (target as ClosestElement).closest === 'function'
  ) {
    const el = target as ClosestElement;
    if (el.closest(EDITABLE_SELECTOR)) return true;
    if (el.closest('[role="menuitem"],[role="menu"]')) return true;
  }
  return false;
}

export function resolveTheme(
  theme: Theme,
  systemIsDark: boolean,
): ResolvedTheme {
  if (theme === 'system') return systemIsDark ? 'dark' : 'light';
  return theme;
}

/** Toggle the *resolved* theme so `system` flips deterministically. */
export function getToggledTheme(
  current: Theme,
  systemIsDark: boolean,
): ResolvedTheme {
  return resolveTheme(current, systemIsDark) === 'dark' ? 'light' : 'dark';
}

export function parseStoredTheme(value: unknown, fallback: Theme): Theme {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return fallback;
}

/**
 * Reads the persisted theme through an injectable getter so the
 * throw-fallback branch is unit-testable with a fake store.
 * (happy-dom binds `localStorage` methods on first use, so neither
 * prototype nor instance patching can simulate a throwing store in
 * component tests — inject instead of patching.)
 */
export function readStoredTheme(
  getItem: (key: string) => string | null,
  storageKey: string,
  fallback: Theme,
): Theme {
  try {
    return parseStoredTheme(getItem(storageKey), fallback);
  } catch {
    return fallback;
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  const resolved = resolveTheme(
    theme,
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

/**
 * Inline pre-hydration script for `<ScriptOnce>` — resolves the theme from
 * localStorage (fallback: dark-first) before React mounts to avoid FOUC.
 */
export function getThemeScript(
  storageKey: string = THEME_STORAGE_KEY,
  defaultTheme: Theme = DEFAULT_THEME,
): string {
  const key = JSON.stringify(storageKey);
  const fallback = JSON.stringify(defaultTheme);
  return `(function(){try{var t=localStorage.getItem(${key});if(t!=='light'&&t!=='dark'&&t!=='system'){t=${fallback}}var d=matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='system'?(d?'dark':'light'):t;var e=document.documentElement;e.classList.add(r);e.style.colorScheme=r}catch(e){}})();`;
}
