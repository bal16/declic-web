import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

import { PinoNestLogger } from './logger';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  // Standalone application context: no HTTP server. BullMQ connections
  // (which keep the process alive) attach here in the next step
  // (PRD-Worker.md §3: image-processing consumer, concurrency 2).
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  const logger = new PinoNestLogger('Bootstrap');
  app.useLogger(logger);
  await app.init();
  logger.log('@declic/worker context ready');
}

void bootstrap();
