import type { Auth } from '@/modules/auth/auth';

export function newFakeAuth(data: unknown): Auth {
  return { api: { getSession: async () => data } } as unknown as Auth;
}
