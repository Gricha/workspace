# Workspace Implementation Tasks

> **Workflow**:
>
> - **Completed tasks are removed** from this list entirely
> - **New task ideas go to Considerations** section first for discussion
> - **Tasks listed below are confirmed work** that must be performed
>
> **Research Tasks**:
>
> - Research tasks are always allowed and should be performed when listed
> - Document findings in `docs/research/RESEARCH_<TOPIC>.md` files
> - Convert research into concrete implementation tasks when complete

---

## Tasks

### Race Conditions & Stability

#### Add proper-lockfile to state file writes
**File**: `src/workspace/state.ts`

The `save()` method writes state to disk without locking. Multiple processes or rapid operations could corrupt the file. The `proper-lockfile` package is already in dependencies but not used here.

**Fix**: Wrap `fs.writeFile()` in `withLock()` pattern used elsewhere in codebase.

#### Fix WebSocket send-after-close race condition
**File**: `src/shared/base-websocket.ts` (line ~76)

Current code checks `ws.readyState === WebSocket.OPEN` then sends, but socket can close between check and send. Need to wrap in try-catch or use a queue pattern.

**Fix**: Add try-catch around `ws.send()` calls and handle CLOSING/CLOSED states gracefully.

#### Add container health check before exec operations
**Files**: `src/workspace/manager.ts` (lines ~444-453, ~529-538)

After `docker.startContainer()`, code immediately runs `docker exec` to copy credentials. Container may not be ready to accept exec commands. Add retry loop with exponential backoff or health check.

**Fix**: Create `waitForContainer(name, timeout)` helper that polls container readiness before returning.

---

### Code Duplication

#### Extract credential setup into single method
**File**: `src/workspace/manager.ts`

The `create()`, `start()`, and `sync()` methods all duplicate these 5 calls:
```typescript
await this.copyGitConfig(containerName);
await this.copyCredentialFiles(containerName);
await this.setupClaudeCodeConfig(containerName);
await this.copyCodexCredentials(containerName);
await this.setupOpencodeConfig(containerName);
```

**Fix**: Create `private async setupWorkspaceCredentials(containerName: string)` and call from all three methods.

#### Create base class for chat WebSocket handlers
**Files**: `src/chat/websocket.ts`, `src/chat/opencode-websocket.ts`

These files are ~95% identical with same connection handling, message routing, and error handling. Only difference is which session factory they call.

**Fix**: Create `src/chat/base-chat-websocket.ts` with shared logic, then have both handlers extend it and override only the session creation method.

#### Abstract shared terminal handler logic
**Files**: `src/terminal/handler.ts`, `src/terminal/host-handler.ts`

Near-identical implementations of terminal session management. Only difference is whether it's container or host terminal.

**Fix**: Create shared base class or extract common helper functions. Keep target-specific spawn logic separate.

---

### Code Bifurcation

#### Refactor listSessionsCore() agent-specific logic
**File**: `src/agent/router.ts` (lines ~533-835)

Three divergent code paths for Claude/OpenCode/Codex session listing. Bug fixes in one don't propagate to others.

**Fix**:
1. Create `src/sessions/agents/` directory with `claude.ts`, `opencode.ts`, `codex.ts`
2. Each exports `listSessions(container)` and `getSession(container, id)` functions
3. `listSessionsCore()` becomes a dispatcher that calls agent-specific implementations
4. Shared parsing/formatting stays in router or moves to `src/sessions/utils.ts`

#### Refactor getSession() agent-specific logic
**File**: `src/agent/router.ts` (lines ~850-1111)

~250 lines across 4 bifurcated paths (host + 3 agent types). Same fix as above - extract agent-specific logic into dedicated modules.

---

### Type Safety

#### Consolidate duplicate WorkspaceState type definitions
**Files**: `src/workspace/types.ts`, `src/shared/types.ts`

Two different `WorkspaceState` type definitions exist. Consolidate into single source of truth in `src/shared/types.ts` and update all imports.

---

### OpenCode Integration

#### Load existing messages when reopening OpenCode session
**Files**: `src/chat/opencode-handler.ts`, `web/src/pages/WorkspaceDetail.tsx`

When reopening an existing OpenCode session via `--session <id>`, the web UI shows an empty chat. Previous messages should be loaded and displayed before accepting new input.

**Fix**:
1. When session ID is provided, first fetch session history from OpenCode storage
2. Parse existing messages from session file (check `~/.local/share/opencode/storage/`)
3. Send historical messages to web client before enabling input
4. Use existing session parser logic from `src/sessions/parser.ts` if applicable

#### Implement OpenCode Server API for real-time streaming
**Files**: `src/chat/opencode-handler.ts`, possibly new `src/chat/opencode-server.ts`

Current implementation uses `opencode run --format json` which works but spawns a new process per message. OpenCode has a built-in server (`opencode serve`) with SSE streaming that would provide:
- Persistent sessions across page reloads
- Real-time status updates
- More efficient connection (single long-lived connection vs process-per-message)

**Fix**:
1. Research: Check if `opencode serve` can run in container and expose API
2. Start `opencode serve` on container startup or on-demand
3. Create new handler that connects to OpenCode's HTTP API
4. Use SSE for streaming responses instead of parsing stdout
5. Keep CLI fallback for environments where server can't run

Reference: [docs/research/RESEARCH_AGENT_TERMINAL.md](./docs/research/RESEARCH_AGENT_TERMINAL.md)

---

### Performance

#### Virtualize long chat session rendering
**File**: `web/src/pages/WorkspaceDetail.tsx` (or wherever chat messages are rendered)

Opening a long chat session (1000+ messages) freezes the browser because all messages are rendered at once. Need to implement virtualized list rendering.

**Fix**:
1. Only render last ~100 messages initially
2. Use virtualization library (react-window or @tanstack/virtual) to render only visible messages
3. Load more messages on scroll up
4. Unload messages when scrolling away to keep DOM size manageable
5. Keep scroll position stable when loading older messages

---

### CI

#### Add explicit typecheck step to test workflow
**File**: `.github/workflows/test.yml`

Build implies typecheck but doesn't make it explicit. Add separate step:
```yaml
- name: Typecheck
  run: bun x tsc --noEmit
```

This makes typecheck failures more visible in CI output.

---

## Considerations

> Add items here to discuss with project owner before promoting to tasks.

### Design Document Updates (Pending Review)

- **Port range discrepancy**: Design says "starts at 4200" but implementation uses 2200-2400
- **SSE streaming not implemented**: Design specifies SSE for log streaming (`?follow=true`) but implementation uses simple request/response
- **Config API is writable**: Design says read-only but implementation allows updates via API (this is better, just document it)

### Token Usage Tracking

Research document: [docs/research/RESEARCH_TOKEN_USAGE.md](./docs/research/RESEARCH_TOKEN_USAGE.md)

Track API token usage across workspaces to monitor costs. Approaches researched:

- Log-based collection from workspaces
- SQLite storage on agent
- Per-agent and per-workspace breakdown
- Cost estimation based on model pricing

### Mock Claude API in Chat Tests

Consider adding MSW (Mock Service Worker) or similar to mock Claude API responses in chat integration tests. This would:
- Avoid requiring real API keys in CI
- Make tests faster and more reliable
- Allow testing of specific response scenarios
