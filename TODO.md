# Workspace Implementation Tasks

> **Important**: Remove tasks from this list when completed. Do not add new tasks without discussing with the project owner first - add them to "Considerations" section instead.

---

## Phase 13: Polish (Future)

- [ ] User documentation
- [ ] Docker image publishing to registry
- [ ] `ws agent logs` command for debugging

---

## Research Tasks

- [ ] Research GitHub Copilot token portability (lower priority)

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
