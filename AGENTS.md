# Agent Instructions

## Quick Reference

```bash
bun run validate  # Run everything: lint, typecheck, build, test
bun run check     # Lint + format check + typecheck only
bun run build     # Build CLI and web UI
bun run test      # Run tests (requires Docker)
```

## Task Management

Read `TODO.md` for current tasks. Reference `DESIGN.md` for architecture.

- Remove tasks when completed (don't leave checked items)
- Add new considerations to the "Considerations" section
- Work through phases in order

## Project Overview

Workspace CLI creates isolated Docker-in-Docker development environments. Distributed architecture with agent daemon, oRPC API, and multiple clients (CLI, TUI, Web UI).

**Runtime**: Bun (not Node.js)
**Language**: TypeScript with ES modules

## Key Patterns

- **Docker via CLI**: All Docker operations via spawned commands, not SDK. See `src/docker/`
- **State**: `~/.workspaces/state/state.json` with file locking via `proper-lockfile`
- **API**: oRPC server in `src/agent/`, client in `src/client/api.ts`
- **Web UI**: React + Vite + shadcn/ui in `web/`
- **TUI**: OpenTUI-based in `src/tui/`

## Code Style

- Minimal dependencies
- No comments in code
- Early returns, fail fast
- Use `withLock()` for state mutations

## Testing

All tests must pass. Run `bun run validate` before completing any task.

- Tests use real Docker containers
- E2E tests in `test/e2e/`
- Integration tests in `test/integration/`
- Web UI tests via Playwright in `test/web/`

If you modify Dockerfile or init scripts, run `workspace build` before testing.

## Known Issues & Workarounds

**OpenTUI types**: The `@opentui/core` package has module resolution issues with TypeScript's NodeNext. Workaround: local type declarations in `src/tui/opentui.d.ts`. Update this file if using new OpenTUI APIs.

**Web UI oRPC URL**: Browser requires absolute URL for oRPC. See `web/src/lib/api.ts` - uses `window.location.origin + '/rpc'`.

## Don't

- Don't add new CLI commands without explicit permission
- Don't break backward compatibility
- Don't use `docker exec` for user interaction (use SSH via `workspace shell`)
- Don't skip failing tests

## Do

- Test with real Docker, not mocks
- Follow naming: `workspace-<name>` for containers, `workspace-internal-` for internal resources
- Keep commands fast (lazy init, container reuse)
