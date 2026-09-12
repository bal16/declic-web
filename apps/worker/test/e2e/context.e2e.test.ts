import 'reflect-metadata';
import { describe, expect, it } from 'bun:test';

import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';

import { ImageProcessor } from '@/image-processing/image.processor';
import { WorkerModule } from '@/worker.module';

import { setupTestEnv } from '../helpers/test-env';

setupTestEnv();

// End-to-end: boots the full module graph (all real providers, init +
// close lifecycle) with only the queue + processor stubbed — no TCP,
// ever, so this stays green with compose down. Real-TCP boot is proven
// by the local-only integration test, not here.
// Run: bun run test:e2e
describe('Worker e2e', () => {
  it('boots the full graph and shuts down cleanly', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(getQueueToken('image-processing'))
      .useValue({})
      .overrideProvider(ImageProcessor)
      .useValue({})
      .compile();
    await moduleRef.init();
    expect(moduleRef.get(WorkerModule, { strict: false })).toBeDefined();
    await moduleRef.close();
  });

  it('refuses to boot without required env', async () => {
    const saved = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    try {
      await expect(
        Test.createTestingModule({ imports: [WorkerModule] })
          .overrideProvider(getQueueToken('image-processing'))
          .useValue({})
          .overrideProvider(ImageProcessor)
          .useValue({})
          .compile(),
      ).rejects.toThrow(/REDIS_URL/);
    } finally {
      if (saved !== undefined) process.env.REDIS_URL = saved;
    }
  });
});
