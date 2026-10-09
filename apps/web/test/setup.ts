/**
 * DOM test environment for web component tests.
 *
 * Loaded via `[test] preload` in apps/web/bunfig.toml, so it runs before
 * every `bun test` invocation from this dir — unit runs, watch mode, and
 * the coverage gate alike.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Guarded for idempotency: this module loads via `[test] preload` and
// may also be imported directly (helpers). Register only when no DOM
// exists yet.
// NOTE (verified empirically): happy-dom binds `localStorage` methods on
// first use — patching `Storage.prototype` (or the instance) afterwards
// has no effect. Never rely on storage patching in tests; inject the
// store instead (see `readStoredTheme`).
if (typeof (globalThis as Record<string, unknown>).window === 'undefined') {
  GlobalRegistrator.register({ url: 'http://localhost:3000' });
}

// React 19 requires this flag for `act()` outside of a test framework
// that sets it (Bun does not).
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom does not implement `matchMedia`, but the theme provider and
// toggle read it. Default: light OS preference. Override per test with
// `stubMatchMedia()`.
function makeMql(matches: boolean): MediaQueryList {
  return {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

function installMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: () => makeMql(matches),
  });
}

installMatchMedia(false);

export function stubMatchMedia(matches: boolean): void {
  installMatchMedia(matches);
}
