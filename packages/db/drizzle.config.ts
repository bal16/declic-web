import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // From the shell (`bun --env-file`) or deploy environment.
    // Never import dotenv or read files here (repo convention).
    url: process.env.DATABASE_URL!,
  },
});
