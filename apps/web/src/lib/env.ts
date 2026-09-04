// Client-exposed web config. Only VITE_*-prefixed vars reach the browser
// (Vite convention); server-only secrets must never use that prefix.
// Defaults point at the local compose API (docs/DEVELOPMENT.md §4).

export const DEFAULT_API_URL = 'http://localhost:3001';

export interface WebEnv {
  VITE_API_URL?: string;
  VITE_BETTER_AUTH_URL?: string;
}

const realEnv: WebEnv =
  typeof import.meta.env === 'object' && import.meta.env !== null
    ? (import.meta.env as WebEnv)
    : {};

export function getApiUrl(env: WebEnv = realEnv): string {
  return env.VITE_API_URL ?? DEFAULT_API_URL;
}

export function getBetterAuthUrl(env: WebEnv = realEnv): string {
  return env.VITE_BETTER_AUTH_URL ?? getApiUrl(env);
}
