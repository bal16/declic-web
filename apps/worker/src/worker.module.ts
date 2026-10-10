import { randomUUID } from 'node:crypto';

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule, nativeLoggerOptions } from 'nestjs-pino';

import { requiredEnv } from './common/config';
import { ImageProcessingModule } from './image-processing/image-processing.module';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // No HTTP here, so genReqId never fires — kept identical to api for
    // one shape everywhere; per-job fields attach via runInContext/assign
    // at the consumer step instead.
    LoggerModule.forRoot({
      pinoHttp: {
        ...nativeLoggerOptions,
        level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
        transport:
          !isProd && !isTest
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        genReqId: (req) => {
          const header = req.headers['x-request-id'];
          const first = Array.isArray(header) ? header[0] : header;
          return first ?? randomUUID();
        },
      },
    }),
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
