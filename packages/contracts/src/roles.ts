import * as z from 'zod';

export const roleSchema = z.enum([
  'VIEWER',
  'PHOTOGRAPHER',
  'CURATOR',
  'ADMIN',
]);
