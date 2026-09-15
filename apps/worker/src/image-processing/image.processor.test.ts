import { describe, expect, it } from 'bun:test';

import { jobWith, newProcessor } from '../../test/helpers/processor.doubles';
import { IMAGE_PROCESSING_VARIANTS } from './variants';

const payload = {
  postId: 'post-1',
  photoItemId: 'item-1',
  s3Key: 'raw-uploads/a.jpg',
};

describe('ImageProcessor.process', () => {
  it('runs fetch → hash → 3 variants → persist → promote in order', async () => {
    const { processor, calls } = await newProcessor();
    await processor.process(jobWith(payload));
    const order = calls.map((c) => c.method);
    expect(order.slice(0, 2)).toEqual(['getObject', 'encode']);
    expect(order.filter((m) => m === 'transform')).toHaveLength(3);
    expect(order.slice(-2)).toEqual(['markFrameReady', 'tryPromoteToPending']);
  });

  it('persists the full derivative payload', async () => {
    const { processor, calls } = await newProcessor();
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
    const { processor } = await newProcessor();
    await expect(processor.process(jobWith({ nope: true }))).rejects.toThrow();
  });
});

describe('ImageProcessor events', () => {
  it('logs active/completed without throwing', async () => {
    const { processor } = await newProcessor();
    const job = jobWith(payload);
    await processor.onJobActive(job);
    await processor.onJobCompleted(job);
  });
});

describe('ImageProcessor.onJobFailed', () => {
  it('marks the work failed on terminal failure', async () => {
    const { processor, calls } = await newProcessor();
    await processor.onJobFailed(jobWith(payload, 'failed'));
    expect(calls.find((c) => c.method === 'markPostFailed')?.args).toEqual([
      'post-1',
    ]);
  });

  it('stays quiet while retries remain', async () => {
    const { processor, calls } = await newProcessor();
    await processor.onJobFailed(jobWith(payload, 'delayed'));
    expect(calls.some((c) => c.method === 'markPostFailed')).toBe(false);
  });

  it('stays quiet on unparseable payloads', async () => {
    const { processor, calls } = await newProcessor();
    await processor.onJobFailed(jobWith({ nope: true }, 'failed'));
    expect(calls.some((c) => c.method === 'markPostFailed')).toBe(false);
  });
});
