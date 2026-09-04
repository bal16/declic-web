import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';

// End-to-end: boots the real AppModule over real HTTP (Express on Bun)
// and exercises it with fetch — no supertest/superagent needed.
// Run: bun run test:e2e   (unit tests stay under src/, see package.json)
describe('API e2e', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.listen(0); // ephemeral port, no conflicts in CI
    const address = app.getHttpServer().address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health returns ok (outside the /api prefix)', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      service: string;
      time: string;
    };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('api');
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });

  it('GET /api/health is 404 (health is excluded from the prefix)', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(404);
  });

  it('GET / is 404 (no root route registered)', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(404);
  });
});
