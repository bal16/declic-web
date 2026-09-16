import type { Db } from '@declic/db';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import { FrameRepository } from '@/image-processing/frame.repository';
import { JobLogsRepository } from '@/image-processing/job-log.repository';

export type PgTestDb = ReturnType<typeof drizzlePglite>;

export interface TestDb {
  client: PGlite;
  db: PgTestDb;
  frameRepo: FrameRepository;
  jobLogsRepo: JobLogsRepository;
  close(): Promise<void>;
}

export async function newTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzlePglite({ client });
  await migrate(db, { migrationsFolder: '../../packages/db/drizzle' });
  const typedDb = db as unknown as Db;
  return {
    client,
    db,
    frameRepo: new FrameRepository(typedDb),
    jobLogsRepo: new JobLogsRepository(typedDb),
    close: () => client.close(),
  };
}
