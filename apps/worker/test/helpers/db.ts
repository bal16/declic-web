import type { Db } from '@declic/db';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import { FrameRepository } from '@/image-processing/frame.repository';

export interface TestDb {
  client: PGlite;
  db: ReturnType<typeof drizzlePglite>;
  repo: FrameRepository;
  close(): Promise<void>;
}

export async function newTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzlePglite({ client });
  await migrate(db, { migrationsFolder: '../../packages/db/drizzle' });
  const repo = new FrameRepository(db as unknown as Db);
  return {
    client,
    db,
    repo,
    close: () => client.close(),
  };
}
