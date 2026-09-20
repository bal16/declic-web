import { roleSchema } from '@declic/contracts';
import * as z from 'zod';

export type Role = z.infer<typeof roleSchema>;

export const ROLE_MATRIX = {
  'users:read': ['ADMIN'],
  'users:write': ['ADMIN'],
  'exhibitions:write': ['ADMIN'],
  'flags:write': ['ADMIN'],
  'settings:write': ['ADMIN'],
  'audit:read': ['ADMIN', 'CURATOR'],
  'moderate:write': ['ADMIN', 'CURATOR'],
  'curate:write': ['ADMIN', 'CURATOR'],
  'posts:write': ['ADMIN', 'PHOTOGRAPHER'],
  'posts:own': ['ADMIN', 'PHOTOGRAPHER'],
} as const;

export type PermissionKey = keyof typeof ROLE_MATRIX;
