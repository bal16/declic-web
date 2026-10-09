import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { jobLogs } from '@declic/db';
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';

import {
  givenPhotoItem,
  givenProcessingPost,
} from '../../test/factories/post.factory';
import { newTestDb, type PgTestDb } from '../../test/helpers/db';
import { JobLogsRepository } from './job-log.repository';

describe('JobLogsRepository (pglite)', () => {
  let client: PGlite;
  let db: PgTestDb;
  let repo: JobLogsRepository;

  beforeAll(async () => {
    const ctx = await newTestDb();
    client = ctx.client;
    db = ctx.db;
    repo = ctx.jobLogsRepo;
  });

  afterAll(async () => {
    await client.close();
  });

  it('logAttempt inserts a completed row', async () => {
    const postId = await givenProcessingPost(db);
    const photoItemId = await givenPhotoItem(db, postId);

    await repo.logAttempt({
      jobId: 'test-job-1',
      postId,
      photoItemId,
      attempt: 1,
      maxAttempts: 3,
      status: 'completed',
      durationMs: 1500,
    });

    const rows = await db
      .select()
      .from(jobLogs)
      .where(eq(jobLogs.jobId, 'test-job-1'));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('completed');
    expect(rows[0].durationMs).toBe(1500);
  });

  it('logAttempt stores error details', async () => {
    const postId = await givenProcessingPost(db);
    const photoItemId = await givenPhotoItem(db, postId);

    await repo.logAttempt({
      jobId: 'test-job-2',
      postId,
      photoItemId,
      attempt: 3,
      maxAttempts: 3,
      status: 'failed_terminal',
      errorName: 'Error',
      errorMessage: 'S3 object not found',
      errorStack: 'Error: S3 object not found\n    at ...',
    });

    const rows = await db
      .select()
      .from(jobLogs)
      .where(eq(jobLogs.jobId, 'test-job-2'));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('failed_terminal');
    expect(rows[0].errorName).toBe('Error');
  });

  it('logAttempt truncates errorStack to 2KB', async () => {
    const postId = await givenProcessingPost(db);
    const photoItemId = await givenPhotoItem(db, postId);
    const longStack = 'x'.repeat(3000);

    await repo.logAttempt({
      jobId: 'test-job-3',
      postId,
      photoItemId,
      attempt: 1,
      maxAttempts: 3,
      status: 'failed_terminal',
      errorStack: longStack,
    });

    const rows = await db
      .select()
      .from(jobLogs)
      .where(eq(jobLogs.jobId, 'test-job-3'));
    const errorStack = rows[0].errorStack;
    if (typeof errorStack !== 'string')
      throw new Error('expected errorStack to be stored');
    expect(errorStack.length).toBe(2000);
  });
});
