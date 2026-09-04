import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'bun:test';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppModule } from './app.module';

// Proves the NestJS DI graph (decorator metadata included) resolves
// under the Bun test runner — the foundation every module test builds on.
describe('AppController (DI)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('resolves via the testing module and serves health()', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const controller = app.get(AppController);
    const result = controller.health();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('api');
  });
});
