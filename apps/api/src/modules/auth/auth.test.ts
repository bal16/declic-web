import { describe, it, expect } from 'bun:test';

import { setupTestEnv } from '../../../test/helpers/test-env';
import { createAuth } from './auth';

setupTestEnv();
describe('createAuth', () => {
  it('builds an auth instance exposing the session api', () => {
    const testAuth = createAuth();
    expect(testAuth).toBeDefined();
    expect(typeof testAuth.api.getSession).toBe('function');
  });

  it('creates independent instances per factory call', () => {
    const instanceA = createAuth();
    const instanceB = createAuth();

    expect(instanceA).not.toBe(instanceB);
  });

  it('defaults new user to the VIEWER Role', () => {
    const testAuth = createAuth();
    const options = testAuth.options as {
      user?: { additionalFields?: { role?: { defaultValue?: string } } };
    };
    const defaultRole = options.user?.additionalFields?.role?.defaultValue;
    expect(defaultRole).toBe('VIEWER');
  });
});
