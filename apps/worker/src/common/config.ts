// Fail-fast env reader. Values come from the environment only
// (compose, --env-file, deploy env) — never from a file or default.
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
