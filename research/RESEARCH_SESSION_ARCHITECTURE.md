# Session Architecture Research

## The Core Problem

When a user starts a Claude Code session from mobile and navigates away, they cannot reconnect to the running session. The current architecture tightly couples the WebSocket connection to the agent subprocess - when the connection drops, the process is either killed or orphaned with no way to reattach.

## Current Architecture Analysis

### Perry's Current Session Flow

```
┌─────────────┐     WebSocket      ┌─────────────────┐     spawn      ┌─────────────┐
│   Mobile    │ ◄───────────────► │  Perry Agent    │ ──────────────► │ claude CLI  │
│   Web UI    │                    │  (host)         │                 │ (container) │
└─────────────┘                    └─────────────────┘                 └─────────────┘
                                          │
                                    On WS close:
                                    process.kill()
```

**Key files:**
- `src/chat/base-chat-websocket.ts:132-138` - On WebSocket close, calls `session.interrupt()`
- `src/chat/base-claude-session.ts:232-244` - `interrupt()` kills the spawned process
- `src/chat/handler.ts:22-52` - Spawns `docker exec claude --print --resume SESSION_ID`

**The problem:** Each message spawns a new `claude` process with `--resume`. The session data persists (in `~/.claude/projects/...`), but there's no persistent process to attach to. When a WebSocket disconnects mid-conversation:
1. The spawned process is killed
2. Session data is partially saved
3. New connection must start fresh, can resume but loses any in-flight response

### OpenCode's Architecture (the model we should follow)

```
┌─────────────┐     HTTP/SSE       ┌─────────────────┐     internal    ┌─────────────┐
│   Mobile    │ ◄───────────────► │  OpenCode       │ ◄─────────────► │   Agent     │
│   Web UI    │                    │  Server         │                 │   Loop      │
│   TUI       │                    │  (persistent)   │                 │ (persistent)│
└─────────────┘                    └─────────────────┘                 └─────────────┘
                                          │
                                    Session Status:
                                    - idle
                                    - busy
                                    - retry
```

**Key insights from OpenCode source (`/tmp/opencode-research/packages/opencode/src/`):**

1. **Persistent Server** (`server/server.ts`)
   - Hono HTTP server running on port 4096
   - REST API for session CRUD
   - SSE endpoints for real-time events
   - Heartbeat every 30s to keep connections alive

2. **Session Status Tracking** (`session/status.ts`)
   - In-memory state tracking: `idle | busy | retry`
   - Events published via bus when status changes
   - Clients query `/session/status` to get current state

3. **Event-Driven Architecture** (`bus/`)
   - All state changes emit events
   - Clients subscribe to `/event` SSE stream
   - Reconnecting client just re-subscribes and gets current state

4. **Session Persistence** (SQLite)
   - Sessions stored in `~/.local/share/opencode/storage/`
   - Messages, parts, metadata all persisted
   - Session continues even if all clients disconnect

5. **Async Prompt Endpoint** (`server/server.ts:1436-1465`)
   - `/session/:id/prompt_async` - returns immediately
   - Session runs in background
   - Client watches via SSE events

## The Two-Agent Problem

Perry needs to support both OpenCode and Claude Code, which have fundamentally different architectures:

| Aspect | OpenCode | Claude Code |
|--------|----------|-------------|
| Architecture | Client/Server | CLI tool |
| Session Management | Built-in daemon | File-based (JSONL) |
| Reconnection | Subscribe to events | `--resume` flag |
| Real-time Output | SSE stream | stdout JSON stream |
| Status Query | `/session/status` API | N/A |
| Process Model | Persistent agent loop | Spawned per-message |

## Proposed Architecture

### Option A: Unified Session Manager (Recommended)

Introduce a **Session Manager** layer that abstracts the differences between agent types:

```
┌─────────────┐     WebSocket      ┌─────────────────┐
│   Mobile    │ ◄───────────────► │  Perry Agent    │
│   Web UI    │                    │                 │
└─────────────┘                    │  ┌───────────┐  │
                                   │  │  Session  │  │
                                   │  │  Manager  │  │
                                   │  └───────────┘  │
                                   └────────┬────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
            ┌───────▼───────┐       ┌───────▼───────┐       ┌───────▼───────┐
            │   OpenCode    │       │  Claude Code  │       │    Codex      │
            │   Adapter     │       │   Adapter     │       │   Adapter     │
            └───────────────┘       └───────────────┘       └───────────────┘
```

**Session Manager Responsibilities:**
1. **Process Lifecycle**: Spawn/manage agent processes independently of client connections
2. **Output Buffering**: Store agent output in a ring buffer, allow late-joining clients to catch up
3. **Status Tracking**: Track session state (running/idle/error) per session
4. **Event Broadcasting**: Push events to all connected clients
5. **Reconnection**: Allow clients to reconnect and receive buffered + live output

**Claude Code Adapter Strategy:**

For Claude Code (no built-in server), we need to:
1. Spawn `claude` process in **detached mode** with output piped to a PTY or file
2. Store output in a buffer managed by Session Manager
3. Keep process running even if WebSocket disconnects
4. On reconnect, replay buffer + stream live output

Implementation options for CC:
- **PTY-based**: Use a PTY (pseudo-terminal) to keep the process running
- **tmux/screen**: Wrap claude in tmux session (simple but adds dependency)
- **Output redirection**: Pipe to file + tail for reconnection
- **Custom daemon**: Small wrapper daemon that manages the process

**OpenCode Adapter Strategy:**

OpenCode already has a server! We should:
1. Start `opencode serve` if not running
2. Use HTTP API for session management
3. Subscribe to SSE for real-time events
4. Perry acts as a thin proxy/aggregator

This is essentially what `opencode-server.ts` already does, but we need to:
- Make session status queryable from Perry API
- Allow clients to reconnect to in-progress sessions
- Surface the "busy" state in the UI

### Option B: Per-Agent Architecture

Instead of a unified manager, each agent type has its own session management strategy:

**OpenCode**: Use as-is via HTTP API (already mostly working)

**Claude Code**: Implement one of:
1. **tmux wrapper**: Spawn `tmux new-session -d 'claude --print ...'`, attach/detach as needed
2. **PTY manager**: Use node-pty to create persistent PTY sessions
3. **Output file**: Write to file, use inotify/tail for live updates
4. **Claude's MCP server**: If Anthropic exposes a server mode in future

### Option C: Move Everything to OpenCode

Given OpenCode's superior architecture:
- Make OpenCode the primary backend
- Remove Claude Code as a direct integration
- OpenCode supports Claude models via its provider system

**Pros:**
- Single, well-architected backend
- Session management solved
- Multi-provider support built-in

**Cons:**
- Loses Claude Code specific features (hooks, MCP, etc.)
- Dependency on third-party project
- May not support all Claude Code capabilities

## Implementation Plan for Option A

### Phase 1: Session Manager Core

Create `src/session-manager/` with:

```typescript
// src/session-manager/types.ts
interface ManagedSession {
  id: string
  workspaceName: string
  agentType: 'claude' | 'opencode' | 'codex'
  status: 'idle' | 'running' | 'error'
  startedAt: Date
  lastActivity: Date
  outputBuffer: RingBuffer<ChatMessage>
  process?: ChildProcess
  clients: Set<WebSocket>
}

// src/session-manager/manager.ts
class SessionManager {
  private sessions: Map<string, ManagedSession>

  // Start or resume a session
  async startSession(sessionId: string, opts: SessionOpts): Promise<void>

  // Connect a client to receive output
  connectClient(sessionId: string, ws: WebSocket): void

  // Disconnect client without killing session
  disconnectClient(sessionId: string, ws: WebSocket): void

  // Get session status
  getStatus(sessionId: string): SessionStatus

  // Send message to session
  sendMessage(sessionId: string, message: string): Promise<void>

  // Interrupt/abort session
  interrupt(sessionId: string): Promise<void>
}
```

### Phase 2: Claude Code Adapter

```typescript
// src/session-manager/adapters/claude.ts
class ClaudeCodeAdapter implements AgentAdapter {
  private pty?: PTY

  async spawn(containerName: string, sessionId?: string): Promise<void> {
    // Spawn claude in PTY for persistent process
    this.pty = spawn('docker', ['exec', '-it', containerName, 'claude', ...])

    // Pipe output through parser to session manager
    this.pty.onData((data) => this.parseAndEmit(data))
  }

  async sendMessage(message: string): Promise<void> {
    // Write to PTY stdin
    this.pty.write(message + '\n')
  }

  async interrupt(): Promise<void> {
    // Send Ctrl+C to PTY
    this.pty.write('\x03')
  }
}
```

### Phase 3: OpenCode Adapter Enhancement

```typescript
// src/session-manager/adapters/opencode.ts
class OpenCodeAdapter implements AgentAdapter {
  private port: number
  private sseConnection?: EventSource

  async connect(containerName: string): Promise<void> {
    this.port = await startOpenCodeServer(containerName)
    this.subscribeToEvents()
  }

  private subscribeToEvents(): void {
    // Subscribe to SSE and forward to session manager
    this.sseConnection = new EventSource(`http://localhost:${this.port}/event`)
    this.sseConnection.onmessage = (e) => this.handleEvent(e)
  }

  async getStatus(sessionId: string): Promise<SessionStatus> {
    // Query OpenCode's status API
    const res = await fetch(`http://localhost:${this.port}/session/status`)
    const statuses = await res.json()
    return statuses[sessionId] ?? { type: 'idle' }
  }
}
```

### Phase 4: API Changes

Add session status to Perry's API:

```typescript
// New endpoints
sessions.getStatus({workspaceName, sessionId}) -> { status: 'idle' | 'running' | 'error' }
sessions.listActive({workspaceName}) -> Array<{sessionId, status, startedAt}>

// WebSocket protocol changes
// On connect, send session status and buffered messages
// Client can specify "resumeFrom" message ID to avoid duplicates
```

### Phase 5: Frontend Changes

Update mobile/web to handle reconnection:

```typescript
// On app foreground/reconnect
const status = await api.sessions.getStatus({workspaceName, sessionId})
if (status === 'running') {
  // Show "Session in progress" indicator
  // Connect to WebSocket to receive updates
  // May receive buffered messages first
}
```

## Technical Considerations

### Output Buffering Strategy

Need to balance memory usage with reconnection capability:
- **Ring buffer**: Keep last N messages (configurable, e.g., 1000)
- **Disk spillover**: For long sessions, persist to file
- **Message IDs**: Each message gets monotonic ID for deduplication

### Process Management

For Claude Code without server mode:
- PTY approach is most robust (keeps stdout/stderr live)
- Need to handle process exit, crash, timeout
- Should save session state before process termination

### Multi-Client Support

If multiple clients connect to same session:
- All receive same output stream
- Only one can send input (or queue inputs)
- Need to handle conflict (show "session controlled by other client")

### State Persistence

Session Manager state should persist across Perry restarts:
- Running sessions info in state.json
- On startup, check if processes still alive
- Reconnect to orphaned OpenCode servers

## Comparison with tmux/shpool Approach

Terminal multiplexers like [tmux](https://github.com/tmux/tmux) and [shpool](https://github.com/shell-pool/shpool) solve a similar problem for shell sessions:

**tmux approach:**
- Create detached session: `tmux new-session -d -s mysession 'claude ...'`
- Attach to view: `tmux attach -t mysession`
- Detach without killing: Ctrl+B, D
- Works but heavyweight, requires tmux in container

**shpool approach (simpler):**
- Lightweight session persistence
- Native scrollback (no special handling)
- Less overhead than tmux

For Perry, we're essentially building a specialized version of this for AI agent sessions.

## Recommendations

1. **Start with OpenCode improvements**: The adapter is almost there, just need to surface status and handle reconnection properly in the UI

2. **Build Claude Code adapter using PTY**: This gives us true session persistence without external dependencies

3. **Unified Session Manager**: Even though adapters differ internally, present a consistent API to the frontend

4. **Keep it simple initially**: Don't over-engineer. Start with single-client per session, add multi-client later if needed

## References

- [OpenCode Server Docs](https://opencode.ai/docs/server/)
- [OpenCode Source](https://github.com/sst/opencode) - see `packages/opencode/src/server/server.ts`
- [shpool - tmux alternative](https://github.com/shell-pool/shpool)
- [Zellij - Modern terminal multiplexer](https://zellij.dev/)
- [node-pty](https://github.com/microsoft/node-pty) - PTY implementation for Node.js

## Sources

- [OpenCode CLI Alternative](https://apidog.com/blog/opencode/)
- [OpenCode vs Claude Code](https://www.novakit.ai/blog/claude-code-vs-opencode-cli-comparison)
- [OpenCode Server Documentation](https://opencode.ai/docs/server/)
- [OpenCode Architecture Deep Dive](https://cefboud.com/posts/coding-agents-internals-opencode-deepdive/)
- [OpenCode Session Management](https://deepwiki.com/opencode-ai/opencode/5.2-session-management)
- [shpool - Lightweight tmux Alternative](https://news.ycombinator.com/item?id=40669337)
- [Session Management with tmux/screen](https://www.linuxjournal.com/content/leveraging-tmux-and-screen-advanced-session-management)
