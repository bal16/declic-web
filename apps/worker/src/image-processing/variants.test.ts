import { describe, expect, it } from 'bun:test';

import { photoVariantEnum } from '@declic/db';

import { IMAGE_PROCESSING_VARIANTS } from './variants';

describe('IMAGE_PROCESSING_VARIANTS', () => {
  it('matches PRD-Worker §2 derivative specs exactly', () => {
    expect(IMAGE_PROCESSING_VARIANTS).toEqual([
      {
        variant: 'thumbnail',
        maxDim: 400,
        format: 'webp',
        quality: 80,
        file: 'thumb.webp',
      },
      {
        variant: 'web',
        maxDim: 1200,
        format: 'webp',
        quality: 85,
        file: 'web.webp',
      },
      {
        variant: 'lightbox',
        maxDim: 2048,
        format: 'webp',
        quality: 88,
        file: 'lightbox.webp',
      },
    ]);
  });

  it('variant names stay in sync with the db enum', () => {
    const fromTable = IMAGE_PROCESSING_VARIANTS.map((v) => v.variant).sort();
    const fromDb = [...photoVariantEnum.enumValues].sort();
    expect(fromTable).toEqual(fromDb);
  });
});
