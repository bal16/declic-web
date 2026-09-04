import 'reflect-metadata';
import { describe, expect, it } from 'bun:test';

import { Test } from '@nestjs/testing';

import { WorkerModule } from './worker.module';

// Proves the worker DI graph compiles under the Bun test runner.
// Queue consumers attach here next (PRD-Worker.md §3) with mocked
// BullMQ queues following this same TestingModule pattern.
describe('WorkerModule (DI)', () => {
  it('compiles the testing module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();
    expect(moduleRef.get(WorkerModule, { strict: false })).toBeDefined();
    await moduleRef.close();
  });
});
