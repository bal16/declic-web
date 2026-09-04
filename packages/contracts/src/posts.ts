import { z } from 'zod';

/**
 * Simplified work-submission shape for the living EXAMPLE module
 * (apps/api/src/modules/examples). Mirrors a slice of
 * POST /api/posts (PRD-API.md §4.1) minus exhibitionId/S3 keys, which need
 * the database and storage layers that do not exist yet.
 *
 * Rules for contract schemas (OpenAPI-friendly):
 * - Prefer plain objects/arrays/enums/optionals — they map 1:1 to OpenAPI.
 * - Avoid .refine()/.transform() here: runtime-enforced but invisible to
 *   generated docs. Put cross-field rules in the service, not the schema.
 */
export const workTypeSchema = z.enum(['SINGLE', 'SERIES']);
export type WorkType = z.infer<typeof workTypeSchema>;

export const createExampleWorkSchema = z.object({
  title: z.string().min(1).max(255),
  caption: z.string().max(2000).optional(),
  type: workTypeSchema,
  itemCount: z.number().int().min(1).max(10),
});
export type CreateExampleWork = z.infer<typeof createExampleWorkSchema>;

export const exampleWorkSchema = createExampleWorkSchema.extend({
  id: z.string(),
  createdAt: z.string(),
});
export type ExampleWork = z.infer<typeof exampleWorkSchema>;
