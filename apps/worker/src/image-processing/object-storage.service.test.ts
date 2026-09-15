import { describe, expect, it } from 'bun:test';

import { newFakeStorage } from '../../test/helpers/storage.doubles';
import { setupTestEnv } from '../../test/helpers/test-env';
import { buildDerivativeKey, buildPublicUrl } from './object-storage.service';

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

describe('ObjectStorageService (fake client)', () => {
  it('getObject returns the exact bytes', async () => {
    const { svc } = newFakeStorage(true);
    const out = await svc.getObject('raw-uploads/a.jpg');
    expect(out).toEqual(Buffer.from([9, 9]));
  });

  it('getObject throws on missing keys', async () => {
    const { svc } = newFakeStorage(false);
    await expect(svc.getObject('nope.jpg')).rejects.toThrow(
      'Object not found in storage: nope.jpg',
    );
  });

  it('putObject records type and returns the public record', async () => {
    const { svc, writes } = newFakeStorage(true);
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
