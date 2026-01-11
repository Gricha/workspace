# Architecture Refactor Discussion (Stashed)

## Current Problems

### 1. State Scatter
- Session state in `SessionManager`
- Connection state in adapter (`status`, `port`, `agentSessionId`)
- Port cache in module-level globals (`serverPorts`, `serverStarting`)

### 2. No Connection Abstraction
Each adapter implements its own connection logic. OpenCode adapter responsibilities:
- Finding/starting OpenCode servers
- Managing ports
- Handling SSE streams
- Message sending
- Error handling

Too many responsibilities in one class.

### 3. SSE is Per-Message (not urgent)
We create a new SSE connection for each message. Works, but inefficient.
A persistent connection would be more robust.

### 4. Reactive Not Proactive
- Check if session exists when we try to use it
- No health monitoring
- No proactive reconnection

## Proposed Architecture

```
                    ┌─────────────────┐
                    │  SessionManager │
                    │  (orchestrator) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────┐  ┌──────▼──────┐  ┌───▼────┐
     │ Connection  │  │   Message   │  │ State  │
     │   Manager   │  │    Queue    │  │  Store │
     │ (health,    │  │ (ordering,  │  │ (disk, │
     │  reconnect) │  │  retry)     │  │ memory)│
     └─────────────┘  └─────────────┘  └────────┘
              │
     ┌────────▼────────┐
     │  AgentAdapter   │
     │  (protocol      │
     │   translation)  │
     └─────────────────┘
```

### Connection Manager
- Owns connection lifecycle
- State machine: DISCONNECTED → CONNECTING → CONNECTED → DISCONNECTED
- Health checks (periodic ping)
- Auto-reconnect with backoff
- Emits connection state changes

### Message Queue
- Queues outgoing messages
- Handles ordering
- Retry logic (with idempotency considerations)
- Circuit breaker for repeated failures

### State Store
- Unified session state
- Disk persistence
- Memory cache
- Clear ownership of state

### Agent Adapter (simplified)
- Only handles protocol translation
- Doesn't manage connections
- Doesn't cache ports
- Receives connection from ConnectionManager

## Implementation Order

1. Extract port management from adapter into ConnectionManager
2. Add connection state machine
3. Move session state into unified StateStore
4. Add health monitoring
5. (Optional) Persistent SSE connection

## When to Do This

When we see:
- Multiple concurrent sessions causing issues
- Long-lived connections needed
- High message volume
- More agent types being added

Current pain level doesn't justify full refactor yet.
