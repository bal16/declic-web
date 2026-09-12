import type { photoVariantEnum } from '@declic/db';

export type PhotoVariant = (typeof photoVariantEnum.enumValues)[number];

export const IMAGE_PROCESSING_VARIANTS: {
  variant: PhotoVariant;
  maxDim: number;
  format: 'webp';
  quality: number;
  file: string;
}[] = [
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
];
