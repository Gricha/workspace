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

### Web Terminal Should Use xterm.js

The web UI terminal should use xterm.js for a proper terminal experience with full PTY support, ANSI colors, scrollback, and proper keyboard handling. Currently using a custom WebSocket terminal that has issues.

### Sessions UI Improvements

From user feedback:
- **Full-screen session view**: When clicking into a session, it should take over the full page body, not be a small embedded component
- **Empty session handling**: Sessions that have few/no actual messages show empty bubbles. Either filter them out better or show a meaningful "No content" state
- **First prompt display**: Show the first user prompt in the session list for context

### Mobile App Feature Parity

The mobile app (`mobile/`) is scaffolded but not functional. Implement basic features to match web:
- Workspace list with status indicators
- Start/stop workspace controls
- Settings (credentials, agents configuration)
- Sessions list and viewing

### Mobile App E2E Testing

Set up Maestro tests for the mobile app. The `.maestro` directory exists but has no actual test flows. Need tests for:
- App launch and workspace list display
- Basic navigation between screens
- Workspace start/stop operations

### Deduplicate Type Definitions

Same interfaces defined in 3 places (src/, web/, mobile/). Export from `src/shared/types.ts` and import in web/mobile clients:
- WorkspaceInfo
- SessionMessage
- CodingAgents
- Credentials
- Scripts

This prevents drift and reduces maintenance burden (currently 5 types × 3 locations = 15 definitions to keep in sync).

### Extract BaseWebSocketServer

`src/terminal/websocket.ts` and `src/chat/websocket.ts` share ~30 lines of duplicate code:
- `handleUpgrade()` method (18 lines identical)
- Connection validation pattern
- `closeConnectionsForWorkspace()` method
- `close()` cleanup method

Create abstract `BaseWebSocketServer` class in `src/shared/websocket.ts` that both extend.

### Deduplicate Credential Copying Logic

`src/workspace/manager.ts` has 3 nearly identical methods (180+ lines total):
- `copyCredentialFiles()` (72 lines)
- `copyClaudeCredentials()` (62 lines)
- `copyCodexCredentials()` (59 lines)

All follow same pattern: check exists → tar if dir → copy → extract → set permissions. Extract into single parameterized helper:
```typescript
private async copyCredentialDirectory(
  source: string,
  dest: string,
  containerName: string,
  permissions?: string
): Promise<void>
```

### Clean Up Stale Documentation

- **Archive DESIGN.md**: Describes aspirational v2, not current implementation. Move to `docs/archived/` or add prominent "VISION DOCUMENT" header
- **Remove PLAN_UI_AND_AGENTS.md**: Outdated planning doc, tasks already in TODO.md
- **Archive RESEARCH_*.md**: Research complete - move findings to code comments or `docs/research/` archive
- **Consolidate docs/ directory**: Overlaps with root docs - either delete or make canonical location

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

### systemd Service Installation

DESIGN.md mentions `ws agent install` for systemd service installation. Not currently implemented. Would allow:
```bash
ws agent install
systemctl start workspace-agent
```

### Large File Refactoring

5 files exceed 500 lines and could be split for maintainability:

| File | Lines | Suggested Split |
|------|-------|-----------------|
| `src/agent/router.ts` | 643 | → workspaces.ts, sessions.ts, config.ts |
| `src/sessions/parser.ts` | 597 | → claude-parser.ts, opencode-parser.ts, codex-parser.ts |
| `src/workspace/manager.ts` | 521 | → Extract credentials.ts, cleanup.ts |
| `src/tui/app.ts` | 487 | → Extract views, handlers |
| `src/index.ts` | 451 | → Split commands by domain |

Lower priority than deduplication - consider after other cleanup.
