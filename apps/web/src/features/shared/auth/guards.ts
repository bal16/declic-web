import { redirect } from '@tanstack/react-router';

import { getSessionRole, type Role } from './session';

export const STAFF_ROLES: Role[] = ['CURATOR', 'ADMIN'];
export const PHOTOGRAPHER_ROLES: Role[] = ['PHOTOGRAPHER', 'ADMIN'];
export const ADMIN_ONLY: Role[] = ['ADMIN'];

/** Anonymous → /login. Returns the role for route context. */
export function requireSession() {
  const role = getSessionRole();
  if (role === null) {
    throw redirect({ to: '/login' });
  }
  return { role };
}

/** Wrong role → fallback (default '/'). Composes on requireSession. */
export function requireRoles(allowed: Role[], fallback = '/') {
  const { role } = requireSession();
  if (!allowed.includes(role)) {
    throw redirect({ to: fallback });
  }
  return { role };
}
