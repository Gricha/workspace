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

### Web Chat: Tool Call Display & State Management

Improve the Chat component (`web/src/components/Chat.tsx`) for better UX when chatting with Claude Code:

1. **Tool calls grouped at top**: Tool use messages should be collected and displayed at the top of the assistant's response, not intertwined between message bubbles
2. **State management cleanup**: Review and fix state management issues in the streaming/message handling logic
3. **Manual testing required**: Test the chat flow manually to verify:
   - Streaming works correctly (messages accumulate, not replace)
   - Tool calls display properly grouped
   - Session ID handling works across messages
   - Reconnection behavior is smooth

### Web Terminal: Replace xterm.js with ghostty-web

Replace the current xterm.js terminal with [ghostty-web](https://github.com/coder/ghostty-web) for a more native terminal experience:

1. Install `@anthropic-ai/ghostty-web` or equivalent package
2. Replace Terminal component implementation (`web/src/components/Terminal.tsx`)
3. Adapt WebSocket communication layer to work with ghostty's API
4. Benefits expected:
   - GPU-accelerated rendering (WebGL2)
   - Better Unicode/emoji support
   - More native-feeling terminal experience
   - Should work better with Claude Code's TUI output

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
