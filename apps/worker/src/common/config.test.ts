import { describe, expect, it } from 'bun:test';

import { requiredEnv } from './config';

describe('requiredEnv', () => {
  it('returns the value when set', () => {
    process.env.DECLIC_TEST_ONLY_VAR = 'hello';
    try {
      expect(requiredEnv('DECLIC_TEST_ONLY_VAR')).toBe('hello');
    } finally {
      delete process.env.DECLIC_TEST_ONLY_VAR;
    }
  });

  it('throws a clear error when missing', () => {
    delete process.env.DECLIC_TEST_ONLY_VAR;
    expect(() => requiredEnv('DECLIC_TEST_ONLY_VAR')).toThrow(
      'Missing required environment variable: DECLIC_TEST_ONLY_VAR',
    );
  });
});
