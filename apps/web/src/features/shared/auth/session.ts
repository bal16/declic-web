import { roleSchema } from '@declic/contracts';
import * as z from 'zod';

import { authClient } from './client';

export type Role = z.infer<typeof roleSchema>;

export function useSessionRole(): Role | null | undefined {
  const { data, isPending } = authClient.useSession();
  if (isPending) return undefined;
  if (!data?.user) return null;

  const parsed = roleSchema.safeParse((data.user as { role?: unknown }).role);
  return parsed.success ? parsed.data : null;
}
