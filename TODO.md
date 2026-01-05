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
