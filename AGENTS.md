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

**Workflow:**

1. Check `REQUIREMENTS.md` for new developer feedback
2. Research requirements as needed (create `RESEARCH_<TOPIC>.md` files)
3. Convert requirements into concrete tasks in `TODO.md`
4. Implement tasks from `TODO.md`
5. Remove completed tasks from `TODO.md`

**Guidelines:**

- Choose tasks based on your perceived priority - no strict ordering required
- Tasks should be detailed enough for a fresh contextless agent to understand, but not overly granular
- Remove tasks when completed (don't leave checked items)
- Add speculative ideas to the "Considerations" section in TODO.md

## Project Overview

Workspace CLI creates isolated Docker-in-Docker development environments. Distributed architecture with agent daemon, oRPC API, and multiple clients (CLI, TUI, Web UI, Mobile).

**Runtime**: Bun (not Node.js)
**Language**: TypeScript with ES modules

**Mobile Parity Goal**: The React Native mobile app (`mobile/`) should maintain feature parity with the web UI. Both should support: workspace list/details, start/stop controls, settings (credentials/agents), and sessions viewing. When adding features to web, consider mobile implementation.

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

**CRITICAL**: You must actually test your changes before claiming they work. Passing `bun run validate` is necessary but NOT sufficient. Automated tests cannot catch everything.

**Testing Protocol:**

1. Run `bun run validate` - all tests must pass
2. **Manually verify** the feature works by:
   - For CLI: Run the actual command and verify output
   - For Web UI: Open browser, perform the action, verify behavior
   - For API: Use curl/test scripts to hit the endpoint
   - For WebSocket endpoints: Write and run a test client script
3. Only then mark the task as complete

**Example verification for WebSocket terminal:**
```bash
# Backend test - verify WebSocket actually works
cat > /tmp/test-ws.ts << 'EOF'
import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:7391/rpc/terminal/myworkspace');
ws.on('open', () => { console.log('OK: connected'); ws.close(); });
ws.on('error', (e) => { console.log('FAIL:', e.message); });
EOF
bun /tmp/test-ws.ts
```

**Test Infrastructure:**
- Tests use real Docker containers
- E2E tests in `test/e2e/`
- Integration tests in `test/integration/`
- Web UI tests via Playwright in `web/e2e/`
- TUI tests via harness in `test/tui/`

If you modify Dockerfile or init scripts, run `workspace build` before testing.

### UI Testing Requirements

**Critical**: User-facing interfaces (Web UI, TUI, mobile apps) MUST have end-to-end tests that exercise the actual interface. Unit tests and integration tests are insufficient because:

- UI code paths can fail silently (rendering issues, event binding, state management)
- Visual and interactive elements can break without triggering code errors
- Framework/library updates can cause regressions not caught by unit tests

**Required e2e coverage for UI:**
- Web apps: Playwright or similar browser automation
- TUI apps: Process harness with output capture and input simulation
- Mobile apps: Appium, Detox, or platform-specific UI testing frameworks

Without e2e tests, there is a very high chance that UI features will be non-functional despite passing other tests.

## Known Issues & Workarounds

**OpenTUI types**: The `@opentui/core` package has module resolution issues with TypeScript's NodeNext. Workaround: local type declarations in `src/tui/opentui.d.ts`. Update this file if using new OpenTUI APIs.

**Web UI oRPC URL**: Browser requires absolute URL for oRPC. See `web/src/lib/api.ts` - uses `window.location.origin + '/rpc'`.

## Don't

- Don't add new CLI commands without explicit permission
- Don't break backward compatibility
- Don't use `docker exec` for user interaction (use SSH via `workspace shell`)
- Don't skip failing tests
- Don't write complex bash scripts that run via docker exec - escaping issues make them fragile. Use TypeScript with multiple simple docker exec calls instead

## Do

- Test with real Docker, not mocks
- Follow naming: `workspace-<name>` for containers, `workspace-internal-` for internal resources
- Keep commands fast (lazy init, container reuse)
