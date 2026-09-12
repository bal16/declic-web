// Single source for dummy env in tests. Every test file calls
// setupTestEnv() at the top instead of scattering literals — identical
// values everywhere means file execution order can never matter.
// Real values flow via --env-file (dev) or deploy env (prod).
export function setupTestEnv(): void {
  process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
  process.env.S3_BUCKET ??= 'test-bucket';
  process.env.S3_ENDPOINT ??= 'http://127.0.0.1:9000';
  process.env.S3_ACCESS_KEY ??= 'test';
  process.env.S3_SECRET_KEY ??= 'test';
  process.env.S3_FORCE_PATH_STYLE ??= 'true';
  process.env.DATABASE_URL ??= 'postgres://test:test@127.0.0.1:5432/test';
}
