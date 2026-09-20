// Single source for dummy env in tests. Every test file calls
// setupTestEnv() at the top instead of scattering literals — identical
// values everywhere means file execution order can never matter.
// Real values flow via --env-file (dev) or deploy env (prod).
export function setupTestEnv(): void {
  // Dummy DB matches the compose defaults and the CI postgres service
  // (declic/declic@localhost/declic_dev — see docker-compose.yml and
  // ci.yml migrate step), so it connects wherever those defaults run.
  process.env.DATABASE_URL ??=
    'postgres://declic:declic@localhost:5432/declic_dev';
  process.env.BETTER_AUTH_URL ??= 'http://localhost:3001';
  process.env.BETTER_AUTH_SECRET ??= 'test-secret';
}
