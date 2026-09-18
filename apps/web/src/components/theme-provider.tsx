import { ScriptOnce } from '@tanstack/react-router';
import { createContext, useContext, useEffect, useState } from 'react';

import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  getThemeScript,
  readStoredTheme,
  type Theme,
} from '@/lib/theme';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  // Lazy initializer reads the persisted value during the first client
  // render (guarded for SSR) so no setState-in-effect round-trip is needed.
  // The `<ScriptOnce>` script above already applied the same value
  // pre-hydration, so the first paint matches.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    return readStoredTheme(
      (key) => window.localStorage.getItem(key),
      storageKey,
      defaultTheme,
    );
  });
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = (next: Theme) => {
    localStorage.setItem(storageKey, next);
    setThemeState(next);
  };

  return (
    <ThemeProviderContext value={{ theme, setTheme }}>
      <ScriptOnce>{getThemeScript(storageKey, defaultTheme)}</ScriptOnce>
      {children}
    </ThemeProviderContext>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
