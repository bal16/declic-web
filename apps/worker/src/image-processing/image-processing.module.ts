import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { BlurhashService } from './blurhash.service';
import { FrameRepository } from './frame.repository';
import { ImageTransformerService } from './image-transformer.service';
import { ImageProcessor } from './image.processor';
import { JobLogsRepository } from './job-log.repository';
import { ObjectStorageService } from './object-storage.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'image-processing' })],
  providers: [
    BlurhashService,
    ImageTransformerService,
    ObjectStorageService,
    FrameRepository,
    JobLogsRepository,
    ImageProcessor,
  ],
})
export class ImageProcessingModule {}
