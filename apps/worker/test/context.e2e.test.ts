import 'reflect-metadata';
import { describe, expect, it } from 'bun:test';

import { NestFactory } from '@nestjs/core';

import { WorkerModule } from '../src/worker.module';

// End-to-end: boots the FULL worker module graph exactly like production
// (createApplicationContext + init + close) instead of an isolated
// TestingModule. Unit tests for individual consumers stay under src/.
// Run: bun run test:e2e
//
// Queue-level e2e (real Redis/MinIO round-trip for image-processing jobs)
// arrives with the consumer step and runs against the compose stack;
// this lifecycle test intentionally needs no infrastructure.
describe('Worker e2e', () => {
  it('boots the full context and shuts down cleanly', async () => {
    const app = await NestFactory.createApplicationContext(WorkerModule, {
      logger: false,
    });
    await app.init();
    expect(app.get(WorkerModule, { strict: false })).toBeDefined();
    await app.close();
  });
});
