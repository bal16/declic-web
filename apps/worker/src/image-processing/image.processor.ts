import { imageProcessingJobSchema } from '@declic/contracts';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { BlurhashService } from './blurhash.service';
import { FrameRepository } from './frame.repository';
import { ImageTransformerService } from './image-transformer.service';
import { JobLogsRepository } from './job-log.repository';
import {
  ObjectStorageService,
  buildDerivativeKey,
} from './object-storage.service';
import { IMAGE_PROCESSING_VARIANTS } from './variants';

@Processor('image-processing', {
  concurrency: 2,
})
export class ImageProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    private readonly imageTransformerService: ImageTransformerService,
    private readonly blurhashService: BlurhashService,
    private readonly storage: ObjectStorageService,
    private readonly frames: FrameRepository,
    private readonly jobLogs: JobLogsRepository,
  ) {
    super();
  }

  async process(job: Job) {
    // Validation point: parse at consume (malformed payloads fail the job).
    const input = imageProcessingJobSchema.parse(job.data);
    const startedAt = Date.now();

    this.logger.log(
      `Processing frame ${input.photoItemId} of work ${input.postId}`,
    );

    await this.jobLogs.logAttempt({
      jobId: job.id!,
      postId: input.postId,
      photoItemId: input.photoItemId,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts ?? 3,
      status: 'running',
    });

    const original = await this.storage.getObject(input.s3Key);
    const blurhash = await this.blurhashService.encode(original);

    const derivatives = [];
    for (const spec of IMAGE_PROCESSING_VARIANTS) {
      const transformed = await this.imageTransformerService.transform(
        original,
        spec,
      );
      const stored = await this.storage.putObject(
        buildDerivativeKey(input.photoItemId, spec.file),
        transformed.bytes,
        'image/webp',
      );
      derivatives.push({
        variant: spec.variant,
        s3Key: stored.s3Key,
        url: stored.url,
        width: transformed.width,
        height: transformed.height,
        sizeBytes: stored.sizeBytes,
      });
    }

    await this.frames.markFrameReady({
      photoItemId: input.photoItemId,
      blurhash,
      derivatives,
    });
    const promoted = await this.frames.tryPromoteToPending(input.postId);
    this.logger.log(
      `Frame ${input.photoItemId} done in ${Date.now() - startedAt}ms ` +
        `(work promoted: ${promoted})`,
    );

    await this.jobLogs.logAttempt({
      jobId: job.id!,
      postId: input.postId,
      photoItemId: input.photoItemId,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts ?? 3,
      status: 'completed',
      durationMs: Date.now() - startedAt,
    });
  }

  @OnWorkerEvent('active')
  onJobActive(job: Job) {
    this.logger.log(`Job started (id = ${job.id})`);
  }

  @OnWorkerEvent('completed')
  onJobCompleted(job: Job) {
    this.logger.log(`Job completed (id = ${job.id})`);
  }

  @OnWorkerEvent('failed')
  async onJobFailed(job: Job) {
    const parsed = imageProcessingJobSchema.safeParse(job.data);
    if (!parsed.success) {
      this.logger.error(
        `Terminal failure with unparseable payload (job ${job.id})`,
      );
      return;
    }

    const state = await job.getState();
    const isTerminal = state === 'failed';

    await this.jobLogs.logAttempt({
      jobId: job.id!,
      postId: parsed.data.postId,
      photoItemId: parsed.data.photoItemId,
      attempt: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 3,
      status: isTerminal ? 'failed_terminal' : 'failed_retryable',
      errorMessage: job.failedReason,
    });

    if (isTerminal) {
      await this.frames.markPostFailed(parsed.data.postId);
      this.logger.error(`Work ${parsed.data.postId} marked FAILED_PROCESSING`);
    }
  }
}
