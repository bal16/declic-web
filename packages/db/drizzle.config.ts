import { defineConfig } from 'drizzle-kit';

// From the shell (`bun --env-file`) or deploy environment.
// Never import dotenv or read files here (repo convention).
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined)
  throw new Error('Missing required environment variable: DATABASE_URL');

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
