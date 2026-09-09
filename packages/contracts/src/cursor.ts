import * as z from 'zod';

export const cursorSchema = z.object({
  cursor: z.string().optional(), // opaque base64url(JSON), never raw cuid2
  limit: z.number().int().min(1).max(50).default(20),
});
export const pageSchema = <T>(item: z.ZodType<T>) =>
  z.object({ data: z.array(item), nextCursor: z.string().nullable() });
