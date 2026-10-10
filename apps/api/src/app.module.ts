import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule, nativeLoggerOptions } from 'nestjs-pino';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ExamplesModule } from './modules/examples/examples.module';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Base module: global config + health only.
// Feature modules land here next (PRD-API.md §1.1):
// auth, users, exhibitions, posts/photo-items, curation, moderation,
// engagement, storage, queue, feature-flags, site-settings, audit.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        ...nativeLoggerOptions,
        level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
        transport:
          !isProd && !isTest
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        // Honor the incoming request id (cross-service correlation);
        // fall back to a fresh UUID when absent.
        genReqId: (req) => {
          const header = req.headers['x-request-id'];
          const first = Array.isArray(header) ? header[0] : header;
          return first ?? randomUUID();
        },
      },
    }),
    AuthModule,
    ExamplesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
