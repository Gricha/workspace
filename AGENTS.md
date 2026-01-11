# Agent Instructions

## Architecture Reference

Read `DESIGN.md` for comprehensive architecture, data models, and API specifications. This document provides implementation guidelines.

## Validation

**Default local validation (fast):**

```bash
bun run validate  # Core: lint + format + build TS/worker + unit tests
```

**Full validation (slow):**

```bash
bun run validate:full  # Core + web build/lint + Playwright
```

Guideline: run `bun run validate` for most iterations; run `bun run validate:full` when you touch the web UI, or when you’re changing core workspace/agent behavior and want end-to-end confidence.

When adding/changing behavior, add tests and run the most relevant ones (unit/integration/e2e) instead of always running the full suite locally.

## Release

To cut a new release:

```bash
# 1) Validate (optional; CI will run on tag)
# bun run validate:full

# 2) Bump version in package.json (patch/minor/major)
# Example: 0.3.13 -> 0.3.14

# 3) Commit + push to main
git add package.json
git commit -m "Bump version to <x.y.z>"
git push origin main

# 4) Tag and push the tag (CI builds/publishes on v* tags)
git tag v<x.y.z>
git push origin v<x.y.z>
```

**Incremental validation during development:**

```bash
bun run check          # Quick: lint + format + typecheck
bun run validate       # Fast: lint + format + build TS/worker + unit tests
bun run validate:full  # Slow: validate + web build/lint + Playwright
bun run build          # Build CLI, worker binary, and web UI
bun run test           # Unit/integration tests (requires Docker)
```

**Manual verification required:**
- CLI: Test actual commands with Docker containers
- Web UI: Test in browser with real agent
- API: Test HTTP/WebSocket endpoints
- Agent: Test daemon startup, workspace lifecycle

**Critical**: Automated tests catch basic issues but cannot verify complete functionality. Always test your changes manually.

## Project Overview

Perry is a distributed development environment orchestrator using Docker-in-Docker containers. Architecture: agent daemon with oRPC API, multiple clients (CLI, Web UI, Mobile).

- **Runtime**: Bun (not Node.js)  
- **Language**: TypeScript with ES modules
- **API**: oRPC server with WebSocket terminals
- **Clients**: CLI with TUI, React web UI, React Native mobile app

See `DESIGN.md` for detailed architecture.

## Implementation Patterns

- **Docker Operations**: CLI spawning (`src/docker/`), not Docker SDK
- **State Management**: File-locked JSON (`~/.config/perry/state.json`)
- **oRPC API**: Type-safe client/server communication
- **Session Management**: Real-time agent session tracking via WebSocket
- **Worker Binary**: Compiled bun binary synced to containers for container-side operations

## Code Requirements

- Minimal dependencies
- Early returns, fail fast  
- TypeScript strict mode
- Use `withLock()` for state mutations
- No comments in code (self-documenting)

## Mobile

**Install deps** (preferred; `mobile/package-lock.json` may be out of sync):
```bash
cd mobile
bun install
```

**Run on a real iOS device** (avoids the "hung" process by separating build and Metro):
```bash
# Terminal 1: build + install to device (exits when done)
cd mobile
bunx expo run:ios --device "<Your iPhone Name>" --no-bundler

# Terminal 2: start Metro for the dev client
cd mobile
bunx expo start --dev-client
```

**Environment**
- Local, gitignored env file: `mobile/.env.local` (Expo runtime vars use `EXPO_PUBLIC_` prefix)

## Testing Guidelines

**Manual Testing Protocol:**
```bash
# Use isolated test agent to avoid conflicts
pkill -f "perry agent" 2>/dev/null
perry agent run --port 7391 &

# Configure test client  
perry config worker localhost:7391

# Test workspace lifecycle
perry list
perry sync <workspace-name>

# Test worker binary in containers
docker exec -u workspace workspace-<name> perry worker sessions list

# Test oRPC API
curl -X POST "http://localhost:7391/rpc/sessions/list" \
  -H "Content-Type: application/json" \
  -d '{"json":{"workspaceName":"<name>"}}'
```

**UI Testing Requirements:**
- Web: Playwright e2e tests required
- Mobile: Must test on real devices/simulators  
- APIs: Test HTTP and WebSocket endpoints

## Requirements

- Prefer `bun run validate` for iteration; run the tests you add/affect, and use `bun run validate:full` when appropriate (web UI / end-to-end changes)
- Test with real Docker containers
- Use SSH for user interaction (not `docker exec`)
- Follow naming: `workspace-<name>` containers, `workspace-internal-` resources  
- Maintain backward compatibility

## Constraints

- No CLI command additions without approval
- No pre-commit hooks (CI handles validation)
- No complex bash in docker exec (use TypeScript)
- No skipping failing tests
