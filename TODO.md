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
