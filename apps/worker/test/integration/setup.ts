import { createDb, type Db } from '@declic/db';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { S3Client } from 'bun';

import { WorkerModule } from '@/worker.module';

// Integration harness: REAL everything (Redis/MinIO/Postgres via compose),
// NO overrides. Requires `podman-compose up -d`. Never runs in CI — no
// workflow calls `test:integration`.
//
// Env strategy: values come from `.env` (via --env-file in the script —
// single source of truth, incl. custom passwords), with compose defaults
// as fallback. Service hostnames are normalized to 127.0.0.1 because
// tests execute on the HOST (compose-internal names only resolve
// inside the bridge network).
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.DATABASE_URL ??=
  'postgres://declic:declic@127.0.0.1:5432/declic_dev';
process.env.S3_BUCKET ??= 'declic';
process.env.S3_ENDPOINT ??= 'http://127.0.0.1:9000';
process.env.S3_ACCESS_KEY ??= 'minioadmin';
process.env.S3_SECRET_KEY ??= 'minioadmin';
process.env.S3_FORCE_PATH_STYLE ??= 'true';

for (const key of ['REDIS_URL', 'DATABASE_URL', 'S3_ENDPOINT'] as const) {
  const value = process.env[key];
  if (value !== undefined) {
    process.env[key] = value
      .replace('://redis:', '://127.0.0.1:')
      .replace('://postgres:', '://127.0.0.1:')
      .replace('://minio:', '://127.0.0.1:')
      .replace('@redis:', '@127.0.0.1:')
      .replace('@postgres:', '@127.0.0.1:')
      .replace('@minio:', '@127.0.0.1:');
  }
}

export interface IntegrationContext {
  moduleRef: TestingModule;
  queue: Queue;
  db: Db;
  s3: S3Client;
}

export async function setupIntegration(): Promise<IntegrationContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [WorkerModule],
  }).compile();
  await moduleRef.init();
  const queue = moduleRef.get<Queue>(getQueueToken('image-processing'));
  const db = createDb();
  const s3 = new S3Client({
    accessKeyId: process.env.S3_ACCESS_KEY as string,
    secretAccessKey: process.env.S3_SECRET_KEY as string,
    bucket: process.env.S3_BUCKET as string,
    endpoint: process.env.S3_ENDPOINT as string,
    virtualHostedStyle: false,
  });
  return { moduleRef, queue, db, s3 };
}

export async function teardownIntegration(
  ctx: IntegrationContext,
): Promise<void> {
  await ctx.moduleRef.close();
}

export async function waitFor<T>(
  check: () => Promise<T | null>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  const startedAt = Date.now();
  for (;;) {
    const value = await check();
    if (value !== null) return value;
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`timed out waiting for ${label}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

export async function sweepKeys(s3: S3Client, keys: string[]): Promise<void> {
  await Promise.allSettled(keys.map((key) => s3.file(key).delete()));
}
