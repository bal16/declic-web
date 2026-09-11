import * as z from 'zod';

export const imageProcessingJobSchema = z.object({
  postId: z.string(), // cuid2
  photoItemId: z.string(), // cuid2
  s3Key: z.string(), // Object Storage key to process
});
