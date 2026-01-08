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

### OpenCode Session Resume Bug

**Problem**: When trying to resume an OpenCode session that was created via the interactive CLI (not through Perry's web UI), the UI hangs with a loading indicator.

**Root Cause**: Perry uses `opencode serve` (HTTP server mode) for container chat. The server maintains its own session state. Sessions created via the interactive OpenCode CLI are NOT known to this server.

**Flow breakdown**:
1. **Listing works** - Perry reads OpenCode's storage directly via `perry worker sessions list`
2. **History loads** - Perry reads messages via `perry worker sessions messages <id>`
3. **Resume fails** - Perry starts `opencode serve` and tries to POST to `/session/<oldId>/message`, but the server doesn't know about that session ID (it wasn't created via POST /session)

**Evidence**:
- `src/chat/opencode-server.ts:140-165`: Only creates a new session if `sessionId` is undefined
- `src/chat/opencode-server.ts:178-194`: Tries to POST to existing session without checking if it exists
- The SSE stream waits for events that never come, causing the hang

**Possible fixes**:
1. Before using an existing sessionId, verify the session exists on the server (GET /session/<id>)
2. If session doesn't exist on server, create it first or fall back to CLI mode
3. Alternative: use CLI mode (`opencode run --resume <id>`) for existing sessions instead of server mode

**Files to modify**:
- `src/chat/opencode-server.ts` - Add session existence check before message POST

---

## Considerations

> Add items here to discuss with project owner before promoting to tasks.

### OpenCode Server API Integration

Research completed - see [RESEARCH_AGENT_TERMINAL.md](./docs/research/RESEARCH_AGENT_TERMINAL.md)

Current approach uses `opencode run --format json` per message. OpenCode has `opencode serve` with HTTP API and SSE streaming that would be more efficient.

**Challenges:**
- OpenCode server runs inside container, Perry agent on host
- Requires either port exposure or docker exec tunneling
- Port exposure needs container/Dockerfile changes
- Docker exec approach doesn't provide significant benefits

**Prerequisites for implementation:**
- Decide on port exposure strategy (add internal port or use SSH tunneling)
- Determine process lifecycle management (on-demand vs always-on)
- @opencode-ai/sdk available for TypeScript client

**Recommendation:** Lower priority given working CLI approach with session history loading. Consider when container port exposure strategy is decided.

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
