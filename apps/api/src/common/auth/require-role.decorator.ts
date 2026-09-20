import { SetMetadata } from '@nestjs/common';

import type { PermissionKey } from './role-matrix';

export const REQUIRE_ROLE_KEY = 'requireRole';
export const RequireRole = (permission: PermissionKey) =>
  SetMetadata(REQUIRE_ROLE_KEY, permission);
