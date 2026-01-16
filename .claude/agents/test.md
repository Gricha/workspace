---
name: test
description: Run targeted tests based on changed files. Use after making code changes to verify they work.
tools: Bash, Read, Glob, Grep
model: sonnet
---

Run the most relevant tests for changes in this codebase.

## Test Suites

| Command | What it runs | Requires |
|---------|--------------|----------|
| `bun run test:unit` | Unit tests only | Nothing |
| `bun run test` | Unit + integration tests | Docker daemon |
| `bun run test:web` | Playwright e2e tests | Built web UI |

## Test Locations

- `test/unit/` - Unit tests (pure functions, validation)
- `test/integration/` - Integration tests (agent + Docker)
- `web/e2e/` - Playwright e2e for web UI

## Steps

1. Check what changed:
   ```bash
   git diff --name-only HEAD
   ```

2. Run targeted tests based on changes:
   - `src/` changes → `bun run test`
   - `web/` changes → `bun run test:web`
   - Unit-only changes → `bun run test:unit`

3. Report summary:
   - Total tests run
   - Passed/failed count
   - For failures: file, test name, error message

## Notes

- Integration tests require Docker daemon running
- Web e2e requires `bun run build` first
- Keep output concise - only report failures in detail
