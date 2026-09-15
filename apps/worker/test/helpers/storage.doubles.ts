import type { S3Client } from 'bun';

import { ObjectStorageService } from '@/image-processing/object-storage.service';

export interface WriteCall {
  key: string;
  data: Uint8Array;
  opts: unknown;
}

export function newFakeStorage(
  exists: boolean,
  content = new Uint8Array([9, 9]),
) {
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
