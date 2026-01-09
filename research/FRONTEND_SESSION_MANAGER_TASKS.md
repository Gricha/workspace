# Frontend Session Manager Integration Tasks

## Overview

The backend session manager has been implemented. It provides a unified API for managing AI agent sessions (Claude, OpenCode) with support for:
- Session persistence and reconnection
- Message buffering for replay on reconnect
- Multiple clients per session
- Cross-interface continuity (start in terminal, continue from phone)

## What's Done (Backend)

### New WebSocket Endpoints
- `ws://host/rpc/live/claude/:workspaceName` - Claude Code sessions
- `ws://host/rpc/live/opencode/:workspaceName` - OpenCode sessions

### WebSocket Protocol

**Connect to session:**
```json
{
  "type": "connect",
  "sessionId": "optional-existing-session-id",
  "agentSessionId": "optional-claude-session-id",
  "model": "optional-model",
  "projectPath": "/path/to/project",
  "resumeFromId": 123  // optional: replay messages after this ID
}
```

**Responses:**
```json
// New session created
{ "type": "session_started", "sessionId": "session-xxx" }

// Joined existing session
{ "type": "session_joined", "sessionId": "session-xxx", "status": "running", "agentSessionId": "..." }

// Agent session ID available (sent as system message)
{ "type": "system", "content": "{\"agentSessionId\":\"abc123\"}" }
```

**Send message:**
```json
{ "type": "message", "content": "Hello" }
```

**Interrupt:**
```json
{ "type": "interrupt" }
```

### New REST API Endpoints
- `POST /rpc/live/list` - List active sessions
- `POST /rpc/live/get` - Get session details
- `POST /rpc/live/getStatus` - Get session status
- `POST /rpc/live/start` - Start new session
- `POST /rpc/live/sendMessage` - Send message to session
- `POST /rpc/live/interrupt` - Interrupt session
- `POST /rpc/live/dispose` - Dispose session
- `POST /rpc/live/getMessages` - Get buffered messages

## Frontend Tasks

### Web UI (`web/src/`)

The web UI has been partially updated but needs testing:

1. **Chat.tsx** - Updated to:
   - Use new `/rpc/live/claude/` and `/rpc/live/opencode/` WebSocket paths
   - Send `connect` message on WebSocket open
   - Parse `session_started` and `session_joined` responses
   - Parse `agentSessionId` from system messages with JSON content

2. **api.ts** - Updated with new `live` router methods

**Testing needed:**
- Verify new chat sessions work
- Verify session reconnection works
- Verify message replay on reconnect (resumeFromId)
- Verify interrupt functionality

### Mobile App (`mobile/src/`)

The mobile app has been partially updated:

1. **SessionChatScreen.tsx** - Updated similar to web Chat.tsx
2. **api.ts** - Updated with new `live` router methods

**Testing needed:**
- Same as web UI
- Verify iOS-specific WebSocket behavior
- Test cross-device session continuity

### Key Code Locations

**Web:**
- `web/src/components/Chat.tsx` - Main chat component
- `web/src/lib/api.ts` - API client

**Mobile:**
- `mobile/src/screens/SessionChatScreen.tsx` - Chat screen
- `mobile/src/lib/api.ts` - API client

### Testing Checklist

- [ ] Start new Claude chat session
- [ ] Start new OpenCode chat session
- [ ] Send messages and receive responses
- [ ] Interrupt running session
- [ ] Reconnect to existing session
- [ ] Verify message history replays on reconnect
- [ ] Cross-device: start on web, continue on mobile
- [ ] Error handling: connection drops, session errors

## Architecture Reference

See `research/SESSION_MANAGER_IMPLEMENTATION.md` for full implementation details.
