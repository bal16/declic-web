import 'reflect-metadata';
import { describe, expect, it } from 'bun:test';

import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';

import { setupTestEnv } from '../test/helpers/test-env';
import { ImageProcessor } from './image-processing/image.processor';
import { WorkerModule } from './worker.module';

setupTestEnv();

// Proves the worker DI graph compiles under the Bun test runner.
// BullMQ queue + processor are stubbed here (no TCP in this file).
// Real-TCP boot is proven by the e2e test with services
// (test/e2e/pipeline.e2e.test.ts, requires docker compose up).
describe('WorkerModule (DI)', () => {
  it('compiles the testing module', async () => {
    // Infra-free: queue + processor stubbed (no TCP in this file).
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(getQueueToken('image-processing'))
      .useValue({})
      .overrideProvider(ImageProcessor)
      .useValue({})
      .compile();
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
