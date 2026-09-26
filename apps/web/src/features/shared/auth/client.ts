import { createAuthClient } from 'better-auth/react';

import { getBetterAuthUrl } from '@/lib/env';

export const authClient = createAuthClient({ baseURL: getBetterAuthUrl() });
