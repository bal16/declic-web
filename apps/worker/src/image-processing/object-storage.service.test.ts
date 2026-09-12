import { describe, expect, it } from 'bun:test';

import type { S3Client } from 'bun';

import { setupTestEnv } from '../../test/helpers/test-env';
import {
  ObjectStorageService,
  buildDerivativeKey,
  buildPublicUrl,
} from './object-storage.service';

setupTestEnv();

describe('buildDerivativeKey', () => {
  it('nests the file under the frame folder', () => {
    expect(buildDerivativeKey('item-1', 'web.webp')).toBe(
      'derivatives/item-1/web.webp',
    );
  });
});

describe('buildPublicUrl', () => {
  it('joins endpoint, bucket, and key', () => {
    expect(
      buildPublicUrl(
        'http://localhost:9000',
        'declic',
        'derivatives/i/web.webp',
      ),
    ).toBe('http://localhost:9000/declic/derivatives/i/web.webp');
  });

  it('tolerates a trailing slash on the endpoint', () => {
    expect(buildPublicUrl('http://localhost:9000/', 'declic', 'a/b.webp')).toBe(
      'http://localhost:9000/declic/a/b.webp',
    );
  });
});

interface WriteCall {
  key: string;
  data: Uint8Array;
  opts: unknown;
}

function fakeService(exists: boolean, content = new Uint8Array([9, 9])) {
  const writes: WriteCall[] = [];
  const fake = {
    file: (_key: string) => ({
      exists: async () => exists,
      arrayBuffer: async () => content.buffer as ArrayBuffer,
    }),
    write: async (key: string, data: Uint8Array, opts: unknown) => {
      writes.push({ key, data, opts });
    },
  };
  return {
    svc: new ObjectStorageService(fake as unknown as S3Client),
    writes,
  };
}

describe('ObjectStorageService (fake client)', () => {
  it('getObject returns the exact bytes', async () => {
    const { svc } = fakeService(true);
    const out = await svc.getObject('raw-uploads/a.jpg');
    expect(out).toEqual(Buffer.from([9, 9]));
  });

  it('getObject throws on missing keys', async () => {
    const { svc } = fakeService(false);
    await expect(svc.getObject('nope.jpg')).rejects.toThrow(
      'Object not found in storage: nope.jpg',
    );
  });

  it('putObject records type and returns the public record', async () => {
    const { svc, writes } = fakeService(true);
    const data = new Uint8Array([1, 2, 3, 4]);
    const stored = await svc.putObject(
      'derivatives/i/w.webp',
      data,
      'image/webp',
    );
    expect(writes).toEqual([
      {
        key: 'derivatives/i/w.webp',
        data,
        opts: { type: 'image/webp' },
      },
    ]);
    expect(stored).toEqual({
      s3Key: 'derivatives/i/w.webp',
      url: 'http://127.0.0.1:9000/test-bucket/derivatives/i/w.webp',
      sizeBytes: 4,
    });
  });
});
