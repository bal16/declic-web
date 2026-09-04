import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { AppModule } from '../src/app.module';
import { setupDocs } from '../src/docs';

// End-to-end for the living EXAMPLE module: full HTTP round-trips proving
// the contracts → DTO → pipe → Swagger chain. Delete with the module when
// the real posts module lands.
// Run: bun run test:e2e
describe('Examples e2e', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    // Production wiring verbatim (main.ts + docs.ts).
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(new ZodValidationPipe());
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

  it('POST /api/examples/works creates a work (201 + cuid id)', async () => {
    const res = await fetch(`${baseUrl}/api/examples/works`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Morning Market',
        type: 'SERIES',
        itemCount: 3,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; title: string };
    expect(body.title).toBe('Morning Market');
    expect(body.id.length).toBeGreaterThan(0);

    const fetched = await fetch(`${baseUrl}/api/examples/works/${body.id}`);
    expect(fetched.status).toBe(200);
  });

  it('POST rejects an empty title (400)', async () => {
    const res = await fetch(`${baseUrl}/api/examples/works`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '', type: 'SINGLE', itemCount: 1 }),
    });
    expect(res.status).toBe(400);
  });

  it('GET unknown id is 404', async () => {
    const res = await fetch(`${baseUrl}/api/examples/works/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it('/docs exposes the Zod-backed DTO schema', async () => {
    const res = await fetch(`${baseUrl}/docs`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('CreateExampleWorkDto');
  });
});
