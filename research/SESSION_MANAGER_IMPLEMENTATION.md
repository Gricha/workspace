# Session Manager Implementation Summary

## What Was Built

A new **Session Manager** layer that provides persistent AI agent sessions with reconnection support. This addresses the core problem: when a user navigates away from mobile, they can now reconnect to running sessions.

## Architecture

```
Frontend (Mobile/Web) ──► WebSocket ──► Perry Agent
                                             │
                                    ┌────────┴────────┐
                                    │ Session Manager │
                                    │  - Process mgmt │
                                    │  - Output buffer│
                                    │  - Client mgmt  │
                                    └────────┬────────┘
                                             │
                        ┌────────────────────┼────────────────────┐
                        │                    │                    │
                  ClaudeAdapter        OpenCodeAdapter      (Codex future)
                  (PTY-based)          (HTTP API-based)
```

## New Files

| File | Purpose |
|------|---------|
| `src/session-manager/types.ts` | Core types: SessionStatus, SessionInfo, AgentAdapter interface |
| `src/session-manager/ring-buffer.ts` | Message buffering for reconnection replay |
| `src/session-manager/manager.ts` | Main SessionManager class - singleton exported as `sessionManager` |
| `src/session-manager/adapters/claude.ts` | Claude Code adapter using Bun PTY for persistent processes |
| `src/session-manager/adapters/opencode.ts` | OpenCode adapter wrapping HTTP server API |
| `src/session-manager/websocket.ts` | LiveChatWebSocketServer for persistent session connections |
| `src/session-manager/index.ts` | Module exports |

## New API Endpoints

All under `live.*`:

| Endpoint | Purpose |
|----------|---------|
| `live.list({workspaceName?})` | List active sessions, optionally filtered by workspace |
| `live.get({sessionId})` | Get session info |
| `live.getStatus({sessionId})` | Get session status (idle/running/error/interrupted) |
| `live.start({...})` | Start a new managed session |
| `live.sendMessage({sessionId, message})` | Send message to session |
| `live.interrupt({sessionId})` | Interrupt running session |
| `live.dispose({sessionId})` | Dispose session and cleanup |
| `live.getMessages({sessionId, sinceId?})` | Get buffered messages (for reconnection) |

## New WebSocket Endpoints

| URL Pattern | Purpose |
|-------------|---------|
| `/rpc/live/claude/:workspaceName` | Persistent Claude Code chat with reconnection |
| `/rpc/live/opencode/:workspaceName` | Persistent OpenCode chat with reconnection |

## WebSocket Protocol

### Client → Server Messages

```typescript
// Connect to existing or start new session
{ type: 'connect', sessionId?: string, agentSessionId?: string, model?: string, resumeFromId?: number }

// Send chat message
{ type: 'message', content: string }

// Interrupt current operation
{ type: 'interrupt' }

// Disconnect (but keep session alive)
{ type: 'disconnect' }
```

### Server → Client Messages

```typescript
// Connection established
{ type: 'connected', workspaceName: string, agentType: string }

// Session started or joined
{ type: 'session_started', sessionId: string }
{ type: 'session_joined', sessionId: string, status: string, agentSessionId?: string }

// Chat messages (same as existing)
{ type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result' | 'error' | 'done', content: string, ... }
```

## Key Features

### 1. Session Persistence
Sessions stay alive even when all clients disconnect. The agent process continues running (for Claude Code) or the OpenCode server session remains active.

### 2. Message Buffering
A ring buffer (default 1000 messages) stores output. When a client reconnects:
- Sends all buffered messages
- Or messages since a specific ID (`resumeFromId`)
- Client catches up and then receives live updates

### 3. Multi-Client Support
Multiple clients can connect to the same session:
- All receive the same output stream
- Only one should send messages (not enforced, but recommended)

### 4. Status Tracking
Sessions have explicit status: `idle`, `running`, `error`, `interrupted`
- Query via API: `live.getStatus({sessionId})`
- Receive status changes via WebSocket

## How Adapters Work

### Claude Code Adapter
Since Claude Code has no server mode, we:
1. Spawn `claude --print --output-format stream-json` in a Bun PTY
2. PTY keeps the process alive with stdout/stderr streams
3. Parse JSON stream and emit messages
4. Process survives client disconnection
5. On reconnect, buffer provides catch-up

### OpenCode Adapter
OpenCode has a built-in server mode:
1. Start `opencode serve` if not running
2. Use HTTP API for session CRUD
3. Subscribe to SSE for real-time events
4. Query `/session/status` for busy/idle state
5. Session persists on server side

## Client API Helpers

```typescript
// Get WebSocket URLs
client.getLiveClaudeUrl(workspaceName)   // ws://host/rpc/live/claude/NAME
client.getLiveOpencodeUrl(workspaceName) // ws://host/rpc/live/opencode/NAME

// Access live session oRPC client
client.live.list({workspaceName})
client.live.getStatus({sessionId})
// etc.
```

## Migration Path

The existing chat WebSocket endpoints (`/rpc/chat/*`, `/rpc/opencode/*`) are **preserved for backward compatibility**. Clients can gradually migrate to the new `/rpc/live/*` endpoints.

Recommended migration:
1. Update mobile app to use new `live` endpoints
2. Update web UI to use new `live` endpoints
3. Eventually deprecate old endpoints

## Next Steps

1. **Frontend Integration**: Update mobile/web to use the new `live.*` API and WebSocket endpoints
2. **Reconnection UI**: Show "Session in progress" indicator when reconnecting to active session
3. **Session List in UI**: Show active sessions per workspace, allow users to reconnect
4. **Testing**: Add integration tests for reconnection scenarios
5. **Codex Adapter**: Implement when needed (similar to Claude adapter)
