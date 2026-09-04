import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  // Standalone application context: no HTTP server. BullMQ connections
  // (which keep the process alive) attach here in the next step
  // (PRD-Worker.md §3: image-processing consumer, concurrency 2).
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'error', 'warn'],
  });
  await app.init();
  console.log('@declic/worker context ready');
}

void bootstrap();
