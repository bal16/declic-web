import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';

import { BlurhashService } from '@/image-processing/blurhash.service';
import { FrameRepository } from '@/image-processing/frame.repository';
import { ImageTransformerService } from '@/image-processing/image-transformer.service';
import { ImageProcessor } from '@/image-processing/image.processor';
import { ObjectStorageService } from '@/image-processing/object-storage.service';

export interface Call {
  method: string;
  args: unknown[];
}

function track(calls: Call[], method: string) {
  return (...args: unknown[]) => {
    calls.push({ method, args });
  };
}

export async function newProcessor() {
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

export function jobWith(data: unknown, state = 'completed'): Job {
  return {
    data,
    getState: async () => state,
  } as unknown as Job;
}
