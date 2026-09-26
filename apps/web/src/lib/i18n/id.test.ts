import { describe, it, expect } from 'bun:test';

import { t } from './id';

describe('i18n id dictionary tests', () => {
  it('returns valid non-empty strings for login keys', () => {
    const keys = [
      'title',
      'hint',
      'providerDisabled',
      'disabledBanner',
      'google',
      'github',
    ] as const;
    for (const key of keys) {
      const result = t('login', key);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('returns valid non-empty strings for authWall keys', () => {
    const keys = ['title', 'message', 'login'] as const;
    for (const key of keys) {
      const result = t('authWall', key);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('returns valid non-empty strings for forbidden keys', () => {
    const keys = ['title', 'message', 'home'] as const;
    for (const key of keys) {
      const result = t('forbidden', key);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });
});
