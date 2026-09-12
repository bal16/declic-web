import 'reflect-metadata';
import { describe, expect, it } from 'bun:test';

import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';

import { setupTestEnv } from '../test/helpers/test-env';
import { ImageProcessor } from './image-processing/image.processor';
import { WorkerModule } from './worker.module';

setupTestEnv();

// Proves the worker DI graph compiles under the Bun test runner.
// BullMQ queue + processor are stubbed here (infra-free rule: no TCP
// in unit/e2e tests, ever — real-TCP boot is proven by the local-only
// integration test).
describe('WorkerModule (DI)', () => {
  it('compiles the testing module', async () => {
    // Infra-free: queue + processor stubbed (no TCP, ever).
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
});
