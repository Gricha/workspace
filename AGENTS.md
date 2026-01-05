# Agent Instructions

## Research Tasks

Research tasks are always allowed and encouraged. When the TODO list contains research tasks, you should:
- Investigate the topic thoroughly using web search, documentation, and code exploration
- Document findings in dedicated research files (e.g., `RESEARCH_<TOPIC>.md`)
- Update TODO.md with concrete implementation tasks based on research findings
- Research tasks help inform implementation decisions and should not be skipped

## Quick Reference

```bash
bun run validate  # Run everything: lint, typecheck, build, test
bun run check     # Lint + format check + typecheck only
bun run build     # Build CLI and web UI
bun run test      # Run tests (requires Docker)
```

## Task Management

**Document Hierarchy:**

| Document | Purpose |
|----------|---------|
| `DESIGN.md` | High-level architecture and goals |
| `REQUIREMENTS.md` | Developer feedback - issues found, things to improve |
| `TODO.md` | Concrete tasks to implement (the work conduit) |
| `docs/` | User-facing Docusaurus documentation site |
| `research/` | Internal research notes (if needed) |

**Workflow:**

1. Check `REQUIREMENTS.md` for new developer feedback
2. Research requirements as needed (create `research/RESEARCH_<TOPIC>.md` files)
3. Convert requirements into concrete tasks in `TODO.md`
4. Implement tasks from `TODO.md`
5. Remove completed tasks from `TODO.md`

**Guidelines:**

- Choose tasks based on priority - no strict ordering required
- Tasks should be detailed enough for a contextless agent but not overly granular
- Remove tasks when completed (don't leave checked items)
- Add speculative ideas to "Considerations" section in TODO.md

## Project Overview

Workspace creates isolated Docker-in-Docker development environments. Distributed architecture: agent daemon, oRPC API, multiple clients (CLI, Web UI, Mobile).

**Runtime**: Bun (not Node.js)
**Language**: TypeScript with ES modules
**Docs**: Docusaurus site in `docs/` for users, root `.md` files for developers

**Mobile Parity**: React Native app (`mobile/`) should match web UI features: workspace list/details, start/stop, settings, sessions.

## Key Patterns

- **Docker via CLI**: Spawned commands, not SDK (`src/docker/`)
- **State**: `~/.workspaces/state/state.json` with file locking (`proper-lockfile`)
- **API**: oRPC server (`src/agent/`), client (`src/client/api.ts`)
- **Web UI**: React + Vite + shadcn/ui (`web/`)
- **Docs**: Docusaurus (`docs/`)

## Code Style

- Minimal dependencies
- No comments in code
- Early returns, fail fast
- Use `withLock()` for state mutations

## Testing

**CRITICAL**: You must actually test your changes before claiming they work. Passing `bun run validate` is necessary but NOT sufficient. Automated tests cannot catch everything.

**Testing Protocol:**

1. `bun run validate` - all tests must pass
2. **Manually verify**:
   - CLI: Run command, verify output
   - Web UI: Test in browser
   - API: curl/test scripts
   - WebSocket: Test client
3. Mark complete only when verified

**Test Infrastructure:**
- Real Docker containers
- E2E: `test/e2e/`
- Integration: `test/integration/`
- Web UI: Playwright (`web/e2e/`)

If modifying Dockerfile/init scripts, run `workspace build` first.

### UI Testing

**Critical**: UI (Web, mobile) MUST have e2e tests. Unit/integration tests miss rendering bugs, event binding issues, and framework regressions.

**Required coverage:**
- Web: Playwright
- Mobile: Appium/Detox

## Known Issues

**Web UI oRPC**: Browser needs absolute URL. See `web/src/lib/api.ts`

## Don't

- Add CLI commands without permission
- Break backward compatibility
- Use `docker exec` for user interaction (use SSH)
- Skip failing tests
- Write complex bash in docker exec (escaping issues - use TypeScript)

## Do

- Test with real Docker
- Follow naming: `workspace-<name>` containers, `workspace-internal-` resources
- Keep commands fast (lazy init, reuse)
