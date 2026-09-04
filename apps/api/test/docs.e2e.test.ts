import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';

// End-to-end: the Scalar API reference is served outside the /api prefix
// (grilled decision: GET /docs, all environments). Companion to
// health.e2e.test.ts — one file per concern.
// Run: bun run test:e2e
describe('API docs e2e', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    // Production wiring verbatim (src/docs.ts): global prefix plus Scalar
    // middleware at /docs, on an ephemeral port.
    const { setupDocs } = await import('../src/docs');

    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api', { exclude: ['health'] });
    setupDocs(app);
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /docs serves the Scalar reference (HTML)', async () => {
    const res = await fetch(`${baseUrl}/docs`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html.length).toBeGreaterThan(0);
  });

  it('GET /api/docs is 404 (docs live outside the /api prefix)', async () => {
    const res = await fetch(`${baseUrl}/api/docs`);
    expect(res.status).toBe(404);
  });
});
