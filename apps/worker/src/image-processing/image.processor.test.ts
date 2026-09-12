import { describe, expect, it } from 'bun:test';

import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';

import { BlurhashService } from './blurhash.service';
import { FrameRepository } from './frame.repository';
import { ImageTransformerService } from './image-transformer.service';
import { ImageProcessor } from './image.processor';
import { ObjectStorageService } from './object-storage.service';
import { IMAGE_PROCESSING_VARIANTS } from './variants';

interface Call {
  method: string;
  args: unknown[];
}

function track(calls: Call[], method: string) {
  return (...args: unknown[]) => {
    calls.push({ method, args });
  };
}

async function setup() {
  const calls: Call[] = [];
  const bytes = new Uint8Array([1, 2, 3]);
  const moduleRef = await Test.createTestingModule({
    imports: [],
    providers: [
      ImageProcessor,
      {
        provide: ImageTransformerService,
        useValue: {
          transform: async (input: Uint8Array, spec: unknown) => {
            track(calls, 'transform')(input, spec);
            return { bytes, width: 100, height: 50 };
          },
        },
      },
      {
        provide: BlurhashService,
        useValue: {
          encode: async (input: Uint8Array) => {
            track(calls, 'encode')(input);
            return 'LEHV6nWB2yk8pyo0adR*';
          },
        },
      },
      {
        provide: ObjectStorageService,
        useValue: {
          getObject: async (key: string) => {
            track(calls, 'getObject')(key);
            return bytes;
          },
          putObject: async (key: string, data: Uint8Array) => {
            track(calls, 'putObject')(key, data);
            return { s3Key: key, url: `http://x/${key}`, sizeBytes: 3 };
          },
        },
      },
      {
        provide: FrameRepository,
        useValue: {
          markFrameReady: async (args: unknown) => {
            track(calls, 'markFrameReady')(args);
          },
          tryPromoteToPending: async (postId: string) => {
            track(calls, 'tryPromoteToPending')(postId);
            return true;
          },
          markPostFailed: async (postId: string) => {
            track(calls, 'markPostFailed')(postId);
          },
        },
      },
      {
        provide: getQueueToken('image-processing'),
        useValue: {},
      },
    ],
  }).compile();
  return { processor: moduleRef.get(ImageProcessor), calls };
}

function jobWith(data: unknown, state = 'completed'): Job {
  return {
    data,
    getState: async () => state,
  } as unknown as Job;
}

const payload = {
  postId: 'post-1',
  photoItemId: 'item-1',
  s3Key: 'raw-uploads/a.jpg',
};

describe('ImageProcessor.process', () => {
  it('runs fetch → hash → 3 variants → persist → promote in order', async () => {
    const { processor, calls } = await setup();
    await processor.process(jobWith(payload));
    const order = calls.map((c) => c.method);
    expect(order.slice(0, 2)).toEqual(['getObject', 'encode']);
    expect(order.filter((m) => m === 'transform')).toHaveLength(3);
    expect(order.slice(-2)).toEqual(['markFrameReady', 'tryPromoteToPending']);
  });

  it('persists the full derivative payload', async () => {
    const { processor, calls } = await setup();
    await processor.process(jobWith(payload));
    const ready = calls.find((c) => c.method === 'markFrameReady');
    expect(ready?.args[0]).toEqual({
      photoItemId: 'item-1',
      blurhash: 'LEHV6nWB2yk8pyo0adR*',
      derivatives: IMAGE_PROCESSING_VARIANTS.map((spec) => ({
        variant: spec.variant,
        s3Key: `derivatives/item-1/${spec.file}`,
        url: `http://x/derivatives/item-1/${spec.file}`,
        width: 100,
        height: 50,
        sizeBytes: 3,
      })),
    });
    const promote = calls.find((c) => c.method === 'tryPromoteToPending');
    expect(promote?.args).toEqual(['post-1']);
  });

  it('rejects payloads outside the contract', async () => {
    const { processor } = await setup();
    await expect(processor.process(jobWith({ nope: true }))).rejects.toThrow();
  });
});

describe('ImageProcessor events', () => {
  it('logs active/completed without throwing', async () => {
    const { processor } = await setup();
    const job = jobWith(payload);
    await processor.onJobActive(job);
    await processor.onJobCompleted(job);
  });
});

describe('ImageProcessor.onJobFailed', () => {
  it('marks the work failed on terminal failure', async () => {
    const { processor, calls } = await setup();
    await processor.onJobFailed(jobWith(payload, 'failed'));
    expect(calls.find((c) => c.method === 'markPostFailed')?.args).toEqual([
      'post-1',
    ]);
  });

  it('stays quiet while retries remain', async () => {
    const { processor, calls } = await setup();
    await processor.onJobFailed(jobWith(payload, 'delayed'));
    expect(calls.some((c) => c.method === 'markPostFailed')).toBe(false);
  });

  it('stays quiet on unparseable payloads', async () => {
    const { processor, calls } = await setup();
    await processor.onJobFailed(jobWith({ nope: true }, 'failed'));
    expect(calls.some((c) => c.method === 'markPostFailed')).toBe(false);
  });
});
