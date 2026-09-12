import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { requiredEnv } from './common/config';
import { ImageProcessingModule } from './image-processing/image-processing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Async: connection read at DI time (not import time) so unit tests
    // can set dummy env before compiling the module.
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: { url: requiredEnv('REDIS_URL') },
      }),
    }),
    ImageProcessingModule,
  ],
})
export class WorkerModule {}
