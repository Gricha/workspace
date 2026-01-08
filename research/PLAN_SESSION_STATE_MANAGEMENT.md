# Session State Management Fix Plan

## Problem Summary

When a user backgrounds the mobile app (or closes browser tab), the WebSocket disconnects and:
1. The backend immediately kills the running Claude process
2. User loses ability to see the response that was being generated
3. On reconnect, user must manually reload to see updated history
4. No way to "attach" to a session that's still running

**User expectation**: "I start a task, close the app, come back later, and see the results"

## Root Cause Analysis

### Confirmed Findings

1. **WebSocket disconnect kills process** (`base-chat-websocket.ts:132-138`)
   ```typescript
   ws.on('close', () => {
     const conn = this.connections.get(ws);
     if (conn?.session) {
       conn.session.interrupt().catch(() => {});  // <-- KILLS PROCESS
     }
     this.connections.delete(ws);
   });
   ```

2. **Session files ARE persisted** - Claude writes to `.jsonl` files in real-time, so even if process dies, history is saved up to that point

3. **Session CAN be resumed** - Claude CLI supports `--resume <sessionId>` flag, so a new message can continue where it left off

4. **No running session tracking** - Server has no concept of "this session is currently processing"

5. **No chat tests exist** - Need to add tests to prevent regressions

## Proposed Solution

### Phase 1: Don't Kill on Disconnect (Backend)

**Change**: Remove the automatic `interrupt()` call on WebSocket close.

**File**: `src/chat/base-chat-websocket.ts`

```typescript
// Before
ws.on('close', () => {
  const conn = this.connections.get(ws);
  if (conn?.session) {
    conn.session.interrupt().catch(() => {});  // Remove this
  }
  this.connections.delete(ws);
});

// After
ws.on('close', () => {
  this.connections.delete(ws);
  // Don't interrupt - let process complete naturally
});
```

**Tradeoff**: Orphan processes may accumulate if user abandons session. Mitigations:
- Claude CLI has built-in timeout
- Add server-side session timeout (future enhancement)

### Phase 2: Track Running Sessions (Backend)

**Add**: A map to track which sessions are currently processing.

**File**: New or extend `src/chat/session-tracker.ts`

```typescript
interface RunningSession {
  sessionId: string;
  workspaceName: string;
  startTime: number;
  onMessage: (msg: ChatMessage) => void;
}

class SessionTracker {
  private runningSessions = new Map<string, RunningSession>();

  register(sessionId: string, session: RunningSession): void;
  unregister(sessionId: string): void;
  isRunning(sessionId: string): boolean;
  getSession(sessionId: string): RunningSession | undefined;
}
```

### Phase 3: Session Attachment (Backend)

**Add**: Allow new WebSocket to attach to running session's output stream.

When client connects with `sessionId`:
1. Check if session is running via `SessionTracker`
2. If running, pipe output to this client too (multicast)
3. If not running, just load history normally

**File**: `src/chat/base-chat-websocket.ts` (extend message handler)

```typescript
if (message.type === 'message' && message.sessionId) {
  // Check if session already running
  const running = sessionTracker.getSession(message.sessionId);
  if (running) {
    // Attach this client to existing output stream
    running.addListener(ws);
    return;
  }
  // Otherwise, create new session as normal
}
```

### Phase 4: Mobile Reconnection (Frontend)

**Add**: AppState listener to detect foreground/background transitions.

**File**: `mobile/src/screens/SessionChatScreen.tsx`

```typescript
import { AppState, AppStateStatus } from 'react-native';

// In component
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      // App came to foreground
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        // Reconnect and reload messages
        reconnect();
      }
    }
  });
  return () => subscription.remove();
}, []);

const reconnect = async () => {
  // 1. Close old connection if exists
  wsRef.current?.close();

  // 2. Reload recent messages from API
  if (currentSessionId) {
    const fresh = await api.getSession(workspaceName, currentSessionId, agentType);
    setMessages(parseMessages(fresh.messages));
  }

  // 3. Re-establish WebSocket
  connect();
};
```

### Phase 5: Web Reconnection (Frontend)

**Add**: Visibility change listener for tab focus.

**File**: `web/src/components/Chat.tsx`

```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Tab became visible
      if (ws?.readyState !== WebSocket.OPEN) {
        reconnect();
      }
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

### Phase 6: Visual Feedback

**Add**: Connection state indicator and reconnection feedback.

- Show "Reconnecting..." when WebSocket is reconnecting
- Show "Loading updates..." when fetching new messages
- Show "Session in progress" if attached to running session

## Test Plan

### Unit Tests (`test/unit/chat/`)

1. **Session lifecycle tests**
   - Session continues after WebSocket disconnect
   - Session can be resumed with same sessionId
   - Multiple clients can attach to same session

2. **Reconnection tests**
   - Client reconnects and receives missed messages
   - Client attaches to running session
   - Client sees completed session after reconnect

### Integration Tests (`test/integration/chat/`)

1. **Full flow tests**
   - Start session → disconnect → session completes → reconnect → see results
   - Start session → disconnect → reconnect while running → see live updates

### E2E Tests

**Mobile** (`mobile/e2e/`):
```typescript
test('session continues after app background', async () => {
  // 1. Start a chat that takes time (ask Claude to count to 100)
  // 2. Background the app
  // 3. Wait for completion time
  // 4. Foreground the app
  // 5. Verify response is visible
});
```

**Web** (`web/e2e/`):
```typescript
test('session continues after tab hidden', async () => {
  // 1. Start a chat
  // 2. Navigate to another tab
  // 3. Wait
  // 4. Return to tab
  // 5. Verify response loaded
});
```

## Implementation Order

1. **Phase 1**: Don't kill on disconnect (smallest change, biggest impact)
2. **Phase 6**: Visual feedback (users can manually refresh for now)
3. **Phase 4 & 5**: Auto-reconnection on foreground
4. **Phase 2 & 3**: Session tracking and attachment (enables live attach)

## Files to Modify

| File | Changes |
|------|---------|
| `src/chat/base-chat-websocket.ts` | Remove interrupt on close, add session tracking |
| `src/chat/session-tracker.ts` | New file for tracking running sessions |
| `mobile/src/screens/SessionChatScreen.tsx` | Add AppState listener, reconnect logic |
| `web/src/components/Chat.tsx` | Add visibilitychange listener, reconnect logic |
| `test/integration/chat/` | New directory for chat tests |
| `mobile/e2e/chat.test.ts` | New E2E tests |
| `web/e2e/chat.spec.ts` | New E2E tests |

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Orphan processes | Claude CLI has timeout; add server cleanup job later |
| Memory leak from session tracking | Clear completed sessions after 5 min |
| Race condition on attach | Use mutex/lock per session |
| Duplicate messages on reconnect | Dedupe by message timestamp/id |
