import * as z from 'zod';

export const imageProcessingJobSchema = z.object({
  postId: z.string(), // cuid2
  photoItemId: z.string(), // cuid2
  s3Key: z.string(), // Object Storage key to process
  curated: z.boolean(), // true = curator replacement pipeline
  revert: z.boolean().optional(), // true = regenerate from original_s3_key
});
