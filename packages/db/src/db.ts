import { drizzle } from 'drizzle-orm/postgres-js';

import { contains, derivatives } from './relations';

// Single client factory for all consumers (api, worker, auth adapter).
// Lazy: no connection opens at import time, so unit tests can import
// schema without a database. URL comes from the environment only
// (compose, --env-file, deploy env) — never from a file or default.
export function createDb(url: string = process.env.DATABASE_URL!) {
  return drizzle(url, { relations: { ...contains, ...derivatives } });
}

export type Db = ReturnType<typeof createDb>;
