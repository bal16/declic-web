import { describe, expect, it } from 'bun:test';

import { DEFAULT_API_URL, getApiUrl, getBetterAuthUrl } from './env';

describe('web env', () => {
  it('falls back to the local API default', () => {
    expect(getApiUrl({})).toBe(DEFAULT_API_URL);
    expect(getBetterAuthUrl({})).toBe(DEFAULT_API_URL);
  });

  it('honours explicit VITE_* values', () => {
    const env = {
      VITE_API_URL: 'https://api.example.com',
      VITE_BETTER_AUTH_URL: 'https://auth.example.com',
    };
    expect(getApiUrl(env)).toBe('https://api.example.com');
    expect(getBetterAuthUrl(env)).toBe('https://auth.example.com');
  });

  it('better-auth falls back to the API url', () => {
    expect(getBetterAuthUrl({ VITE_API_URL: 'https://api.example.com' })).toBe(
      'https://api.example.com',
    );
  });
});
