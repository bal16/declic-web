import { mock } from 'bun:test';

// Controllable session double (worker-style `given*` setter below).
// mock.module is hoisted, so this runs before the imports that follow.
let currentRole: Role | null = 'ADMIN';

mock.module('./session', () => ({
  getSessionRole: () => currentRole,
  useSessionRole: () => currentRole,
}));

import { afterEach, describe, expect, it } from 'bun:test';

import {
  ADMIN_ONLY,
  PHOTOGRAPHER_ROLES,
  STAFF_ROLES,
  requireRoles,
  requireSession,
} from './guards';
import type { Role } from './session';

/** Arrange: the session the guards will see. */
function givenRole(role: Role | null): void {
  currentRole = role;
}

function catchRedirect(fn: () => unknown): Response {
  try {
    fn();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
  throw new Error('expected a redirect to be thrown');
}

function expectRedirectTo(res: Response, to: string): void {
  expect(res.status).toBeGreaterThanOrEqual(300);
  expect(res.status).toBeLessThan(400);
  const options = (res as unknown as { options?: { to?: unknown } }).options;
  expect(options?.to).toBe(to);
}

afterEach(() => {
  givenRole('ADMIN');
});

describe('requireSession', () => {
  it('returns the role when logged in', () => {
    givenRole('CURATOR');
    expect(requireSession()).toEqual({ role: 'CURATOR' });
  });

  it('redirects anonymous to /login', () => {
    givenRole(null);
    const res = catchRedirect(() => requireSession());
    expectRedirectTo(res, '/login');
  });
});

describe('requireRoles', () => {
  it('passes allowed roles and returns them for route context', () => {
    givenRole('PHOTOGRAPHER');
    expect(requireRoles(PHOTOGRAPHER_ROLES)).toEqual({
      role: 'PHOTOGRAPHER',
    });
  });

  it('redirects to / by default for insufficient role', () => {
    givenRole('VIEWER');
    const res = catchRedirect(() => requireRoles(PHOTOGRAPHER_ROLES));
    expectRedirectTo(res, '/');
  });

  it('redirects to the custom fallback when given', () => {
    givenRole('CURATOR');
    const res = catchRedirect(() => requireRoles(ADMIN_ONLY, '/moderation'));
    expectRedirectTo(res, '/moderation');
  });

  it('redirects anonymous to /login, not the role fallback', () => {
    givenRole(null);
    const res = catchRedirect(() => requireRoles(ADMIN_ONLY));
    expectRedirectTo(res, '/login');
  });
});

describe('role sets', () => {
  it('covers the documented matrix', () => {
    expect(STAFF_ROLES).toEqual(['CURATOR', 'ADMIN']);
    expect(PHOTOGRAPHER_ROLES).toEqual(['PHOTOGRAPHER', 'ADMIN']);
    expect(ADMIN_ONLY).toEqual(['ADMIN']);
  });
});
