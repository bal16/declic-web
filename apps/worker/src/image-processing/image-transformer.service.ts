import { Injectable } from '@nestjs/common';

import type { IMAGE_PROCESSING_VARIANTS } from './variants';

export type VariantSpec = (typeof IMAGE_PROCESSING_VARIANTS)[number];

export interface TransformedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

@Injectable()
export class ImageTransformerService {
  constructor() {}
  async transform(
    buffer: Uint8Array,
    spec: VariantSpec,
  ): Promise<TransformedImage> {
    const meta = await new Bun.Image(buffer).metadata();
    const scale = spec.maxDim / Math.max(meta.width, meta.height);
    const width = Math.max(1, Math.round(meta.width * scale));
    const height = Math.max(1, Math.round(meta.height * scale));
    const bytes = await new Bun.Image(buffer)
      .resize(spec.maxDim, undefined, { fit: 'inside' })
      .webp({ quality: spec.quality })
      .bytes();
    return { bytes, width, height };
  }
}
