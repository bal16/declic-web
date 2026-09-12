import 'reflect-metadata';
import { describe, expect, it } from 'bun:test';

import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';

import { setupTestEnv } from '../../test/helpers/test-env';
import { ImageProcessingModule } from './image-processing.module';
import { ImageProcessor } from './image.processor';

setupTestEnv();

describe('ImageProcessingModule (DI)', () => {
  it('compiles the testing module', async () => {
    // Infra-free: queue + processor stubbed (no TCP, ever). Real-TCP boot
    // is proven by the local-only integration test, not here.
    const moduleRef = await Test.createTestingModule({
      imports: [ImageProcessingModule],
    })
      .overrideProvider(getQueueToken('image-processing'))
      .useValue({})
      .overrideProvider(ImageProcessor)
      .useValue({})
      .compile();
    expect(
      moduleRef.get(ImageProcessingModule, { strict: false }),
    ).toBeDefined();
    await moduleRef.close();
  });
});
