import { describe, expect, it } from 'bun:test';

import { getSessionRole, useSessionRole } from './session';

// The stub is intentionally trivial: it documents the swap point for
// Better Auth. These tests pin the stub contract, not real auth.
describe('session stub', () => {
  it('returns ADMIN until Better Auth lands', () => {
    expect(getSessionRole()).toBe('ADMIN');
    expect(useSessionRole()).toBe('ADMIN');
  });
});
