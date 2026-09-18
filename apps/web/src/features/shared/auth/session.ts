import { roleSchema } from '@declic/contracts';
import * as z from 'zod';

export type Role = z.infer<typeof roleSchema>;

// TEMPORARY stub until Better Auth lands. Single swap point: replace the
// body of getSessionRole() with the real session lookup; guards and
// components stay untouched.
export function getSessionRole(): Role | null {
  return 'ADMIN'; //Edit this for testing different roles: 'VIEWER' | 'CURATOR' | 'PHOTOGRAPHER' | 'ADMIN'
}

export function useSessionRole(): Role | null {
  return getSessionRole();
}
