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

### UI Feedback Round 1

#### Workspaces Page
- [ ] **Convert workspaces page from cards to table layout**
  - File: `web/src/pages/Workspaces.tsx`
  - Replace card grid with a table showing: name, status, path, created date, actions
  - Use shadcn Table component for consistency

- [ ] **Change workspace click behavior: navigate to sessions instead of details**
  - File: `web/src/pages/Workspaces.tsx`
  - Currently clicking a workspace goes to `/workspaces/{name}` (details page)
  - Change to navigate to `/workspaces/{name}/sessions` instead

- [ ] **Add settings button/tab to access workspace details from sessions view**
  - File: `web/src/pages/WorkspaceSessions.tsx` (or create if needed)
  - Add a "Settings" or gear icon button that links to workspace details/config
  - User should be able to access workspace settings without going back to list

- [ ] **Add confirmation dialog for workspace deletion**
  - File: `web/src/pages/WorkspaceDetails.tsx` (wherever delete button exists)
  - Use shadcn AlertDialog component
  - Require typing workspace name to confirm (prevents accidental deletion)

#### Settings Pages
- [ ] **Move delete/stop actions to a dedicated "Danger Zone" tab**
  - Files: Settings pages in `web/src/pages/settings/`
  - Currently destructive actions are inline with other settings
  - Create a separate tab at the end for delete/stop operations
  - Use red/warning styling to indicate danger

- [ ] **Standardize layout widths across all settings pages**
  - Files: `web/src/pages/settings/Environment.tsx`, `Agents.tsx`, `Files.tsx`
  - Currently env vars, coding agents, credential files pages have inconsistent widths
  - Use same max-width container and card sizing across all

#### Chat Component Cleanup
- [ ] **Remove vertical connector lines from chat messages**
  - File: `web/src/components/Chat.tsx`
  - The `isInTurn` prop adds vertical lines between related messages
  - Remove the connector line divs (the 0.5px border elements)

- [ ] **Remove agent avatar icon and bubble from assistant text messages**
  - File: `web/src/components/Chat.tsx`
  - Assistant text should render directly on background without avatar or bubble wrapper
  - Keep the message content, just remove visual container

- [ ] **Keep tool calls in bubbles, keep user messages in bubbles**
  - File: `web/src/components/Chat.tsx`
  - Tool use/result components (`ToolUseBubble`, `ToolResultBubble`) should stay in bubbles
  - User messages should stay in bubbles
  - Only assistant text messages lose their bubble

- [ ] **Remove user avatar icon from chat messages**
  - File: `web/src/components/Chat.tsx`
  - User messages currently show an avatar icon
  - Remove the icon, keep the bubble styling

- [ ] **Fix chat input box to extend to bottom of screen**
  - File: `web/src/components/Chat.tsx`
  - Currently there's a gap between chat input and screen bottom
  - Adjust flex layout or padding to make input touch bottom edge

#### Agent Terminal Integration (Research Required)
- [ ] **Research: How OpenCode and Codex handle chat/terminal experience**
  - Document findings in `docs/research/RESEARCH_AGENT_TERMINAL.md`
  - Questions to answer:
    - How does OpenCode display its TUI? Does it have a web-viewable terminal?
    - How does Codex handle interactive terminal sessions?
    - Can we capture/stream terminal output to web UI?
    - What's the best UX for non-Claude-Code agents?

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

### systemd Service Installation

DESIGN.md mentions `ws agent install` for systemd service installation. Not currently implemented. Would allow:
```bash
ws agent install
systemctl start workspace-agent
```

### Mock Claude API in Chat Tests

Consider adding MSW (Mock Service Worker) or similar to mock Claude API responses in chat integration tests. This would:
- Avoid requiring real API keys in CI
- Make tests faster and more reliable
- Allow testing of specific response scenarios

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
