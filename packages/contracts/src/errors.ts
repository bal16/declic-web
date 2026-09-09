import * as z from 'zod';

export const errorSchema = z.object({
  code: z.string(), // FE branches on code, never on message
  message: z.string(),
  details: z.unknown().optional(),
});
