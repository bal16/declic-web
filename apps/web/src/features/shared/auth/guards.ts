import { roleSchema } from '@declic/contracts';
import { redirect } from '@tanstack/react-router';

import { authClient } from './client';
import { type Role } from './session';

export const STAFF_ROLES: Role[] = ['CURATOR', 'ADMIN'];
export const PHOTOGRAPHER_ROLES: Role[] = ['PHOTOGRAPHER', 'ADMIN'];
export const ADMIN_ONLY: Role[] = ['ADMIN'];

async function fetchRole(): Promise<Role | null> {
  try {
    const { data } = await authClient.getSession();
    if (!data?.user) return null;
    const parsed = roleSchema.safeParse((data.user as { role?: unknown }).role);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Anonymous → /login. Returns the role for route context. */
export async function requireSession() {
  const role = await fetchRole();
  if (role === null) {
    throw redirect({ to: '/login' });
  }
  return { role };
}

/** Wrong role → fallback (default '/'). Composes on requireSession. */
export async function requireRoles(allowed: Role[], fallback = '/') {
  const { role } = await requireSession();
  if (!allowed.includes(role)) {
    throw redirect({ to: fallback });
  }
  return { role };
}
