# declic-web (read-only mirror)

Generated artifact — **do not push here and do not edit here.**

Source of truth: `bal16/declic` (private monorepo).
This branch (`mirror-web`) is rebuilt from `main` on every mirror run
(`bash scripts/mirror.sh web`, see `docs/adr/ADR-001-monorepo-mirror.md`).

Standalone build:

```bash
bun install --frozen-lockfile
bun run --filter "@declic/web" build
```
