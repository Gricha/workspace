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

## Tasks

### TUI/CLI Terminal Should Use SSH

When using TUI or CLI for terminal access, use SSH command instead of the bun WebSocket terminal. SSH provides a better terminal experience with proper PTY handling, scrollback, etc.

### Optimize Sessions Listing

The sessions API makes N*4 sequential docker exec calls (list dirs, stat files, count lines, get first prompt). This is extremely slow. Should batch into a single script that runs inside the container and returns all session data as JSON.

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
