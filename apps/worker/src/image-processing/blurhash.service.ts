import { Injectable } from '@nestjs/common';
import { encode } from 'blurhash';
import { PNG } from 'pngjs';

@Injectable()
export class BlurhashService {
  constructor() {}
  async encode(input: Uint8Array): Promise<string> {
    const tiny = await new Bun.Image(input)
      .resize(32, 32, { fit: 'inside' })
      .png()
      .bytes();

    const { width, height, data } = PNG.sync.read(Buffer.from(tiny)); // pngjs

    return encode(new Uint8ClampedArray(data), width, height, 4, 3); // blurhash
  }
}
