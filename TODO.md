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
> - Document findings in `RESEARCH_<TOPIC>.md` files
> - Convert research into concrete implementation tasks when complete

---

### P1: Agent Chat UI Improvements

**Vision**: Remote chat interface for controlling agents in workspaces when away from terminal.

- **Not a replacement** for terminal — Claude Code's terminal UX is superior for desktop work
- **Remote access use case** — check on agents, send commands, review progress from web/mobile
- **Requires running workspace** — agents execute inside the workspace container
- **Future**: Same interface powers mobile app

**Problem**: Current Sessions page uses terminal fallback. Need proper chat interface for remote UX.

**Phase 3: Interactive Chat (Streaming)**

- [ ] Integrate with Agent SDK for real-time streaming
- [ ] Add input box for sending new messages
- [ ] Handle streaming responses with typing indicators
- [ ] Support for interrupting/canceling responses

**Frontend Polish** (use `frontend-design` skill):

- [ ] Redesign Sessions page with better visual hierarchy
- [ ] Improve session list with better cards/previews
- [ ] Add empty states and loading skeletons
- [ ] Mobile-responsive chat layout

**Files**:

- `web/src/pages/Sessions.tsx`
- `web/src/components/ChatView.tsx` (new)
- `web/src/components/MessageBubble.tsx` (new)
- `web/src/components/SessionCard.tsx` (new)

---

## Phase 13: Polish (Future)

- [ ] User documentation
- [ ] Docker image publishing to registry
- [ ] `ws agent logs` command for debugging

---

## Considerations

> Add items here to discuss with project owner before promoting to tasks.

### Design Document Updates (Pending Review)

- **Port range discrepancy**: Design says "starts at 4200" but implementation uses 2200-2400
- **SSE streaming not implemented**: Design specifies SSE for log streaming (`?follow=true`) but implementation uses simple request/response
- **Config API is writable**: Design says read-only but implementation allows updates via API (this is better, just document it)

### Token Usage Tracking

Research document: [RESEARCH_TOKEN_USAGE.md](./RESEARCH_TOKEN_USAGE.md)

Track API token usage across workspaces to monitor costs. Approaches researched:

- Log-based collection from workspaces
- SQLite storage on agent
- Per-agent and per-workspace breakdown
- Cost estimation based on model pricing

### Other

- Add unit test directory structure (`test/unit/`)
- Consider consolidating all types to `src/shared/types.ts`
