# Mobile Demo Mode Implementation Plan

## Overview

Add a demo mode to the mobile app activated by using `perry-demo` as the server hostname. This enables app store reviewers to experience the app without requiring real server infrastructure.

## Architecture

**Goal**: Minimize bifurcation and future maintenance burden.

Target: only `mobile/src/lib/api.ts` must know about demo mode (optional: Settings can *display* demo state, but the rest of the UI should not branch).

Key idea: treat `perry-demo` like a normal “server config” value, and have `saveServerConfig()` + `loadServerConfig()` persist an `isDemoMode` flag. The screens keep calling the same `api.*` methods; `api.ts` routes those calls to either a real driver (oRPC client) or a demo driver (fixtures + local state).

```
┌─────────────────────────────────────────────────────────┐
│                    SetupScreen                          │
│     Calls saveServerConfig(host, port) as usual          │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
         ┌───────────────────────────┐
         │          api.ts           │
         │  Detects host=perry-demo  │
         │  Loads/saves demo flag    │
         │  Routes to real/demo impl │
         └────────────┬──────────────┘
                      │
                      ▼
         ┌───────────────────────────┐
         │     Unified API surface   │
         │       api.listWorkspaces  │
         │       api.getInfo         │
         │       createChatWebSocket │
         │       getTerminalHtml     │
         └───────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Screens │     │  Screens │     │  Screens │
│ (normal) │     │ (normal) │     │ (normal) │
└──────────┘     └──────────┘     └──────────┘
```

**Key insight**: keep the UI calling the same functions it already calls today; route inside `api.ts` rather than sprinkling `if (demo)` across screens.

## Files to Create

### 1. `mobile/src/lib/demo/data.ts`
Static demo data fixtures:
- 2 demo workspaces: `demo-project` (running), `experiment` (stopped)
- 3 demo sessions with message history
- Mock host info, server info
- Model list (claude-sonnet-4-20250514, etc.)

### 2. `mobile/src/lib/demo/chat.ts`
Mock WebSocket class:
- `DemoChatWebSocket` class implementing WebSocket interface
- Pre-scripted conversation with streaming simulation
- Tool use demonstrations (Read, Bash, Glob)
- Same message format as real WebSocket

### 3. `mobile/src/lib/demo/terminal-html.ts`
Mock terminal HTML (like existing `terminal-html.ts` but self-contained):
- Embedded xterm.js (reuse from existing)
- JavaScript that simulates shell instead of connecting to WS
- Responds to basic commands (ls, pwd, cd, cat, echo, git status)

## Files to Modify

### 1. `mobile/src/lib/api.ts` (main change - encapsulation here)
Refactor to encapsulate all demo logic **and persistence**.

The mobile app already persists server config in `AsyncStorage` via `saveServerConfig()`/`loadServerConfig()`.

Extend that config shape to include a demo flag and make demo activation happen inside `saveServerConfig()` (so `SetupScreen` doesn’t need to branch):

```ts
// persisted config
interface ServerConfig {
  host: string
  port: number
  mode?: 'real' | 'demo'
}

const normalizeHost = (host: string) => host.trim().toLowerCase()
const isDemoHost = (host: string) => normalizeHost(host) === 'perry-demo'

export async function saveServerConfig(host: string, port: number): Promise<void> {
  const mode: ServerConfig['mode'] = isDemoHost(host) ? 'demo' : 'real'
  const config: ServerConfig = { host, port, mode }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  baseUrl = `http://${host}:${port}`
  setApiDriver(mode)
}

export async function loadServerConfig(): Promise<ServerConfig | null> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  const config = JSON.parse(stored) as ServerConfig
  baseUrl = `http://${config.host}:${config.port}`
  setApiDriver(config.mode ?? 'real')
  return config
}
```

Then implement a driver switch:

```ts
type ApiDriver = {
  listWorkspaces(): Promise<WorkspaceInfo[]>
  getInfo(): Promise<InfoResponse>
  // ...include every api.* method used by screens
}

let driver: ApiDriver = realDriver

function setApiDriver(mode: 'real' | 'demo') {
  driver = mode === 'demo' ? demoDriver : realDriver
}

export const api = {
  listWorkspaces: (...args) => driver.listWorkspaces(...args),
  getInfo: (...args) => driver.getInfo(...args),
  // ...thin wrappers for every existing api.* export
}

// helpers used directly by screens
export function createChatWebSocket(workspaceName: string, agentType: AgentType): WebSocket {
  return driver === demoDriver
    ? new DemoChatWebSocket({ workspaceName, agentType })
    : new WebSocket(getChatUrl(workspaceName, agentType))
}

export function getTerminalHtml(): string {
  return driver === demoDriver ? DEMO_TERMINAL_HTML : TERMINAL_HTML
}
```

**Why this helps long-term**: as the app grows, screens keep importing/calling `api.*` and the demo behavior stays behind a single switch. No spreading `if (demo)` checks.

### 2. `mobile/src/screens/SetupScreen.tsx`
No demo-specific branching needed.

`SetupScreen` already calls `saveServerConfig()` and then `api.getInfo()` (`mobile/src/screens/SetupScreen.tsx:49-53`). If `saveServerConfig()` handles `host === 'perry-demo'`, the rest of the flow stays identical.

Optional UX (non-essential): if `host === 'perry-demo'`, show a one-line hint like “Demo mode enabled” after connect succeeds.

### 3. `mobile/src/screens/SessionChatScreen.tsx`
Minimal change: use factory instead of `new WebSocket(getChatUrl(...))`.

Current code constructs the socket directly (`mobile/src/screens/SessionChatScreen.tsx:545-547`) and relies on:
- `ws.onopen`, `ws.onmessage`, `ws.onclose`, `ws.onerror`
- `ws.readyState` compared to `WebSocket.OPEN/CLOSED/CLOSING`
- `ws.send()` and `ws.close()`

Change to:

```ts
// Before:
const url = getChatUrl(workspaceName, agentType)
const ws = new WebSocket(url)

// After:
const ws = createChatWebSocket(workspaceName, agentType)
```

No `if (demo)` checks in the screen; the factory returns a real or demo-compatible socket.

### 4. `mobile/src/screens/TerminalScreen.tsx`
Minimal change: swap the HTML source, keep the screen logic.

`TerminalScreen` currently:
- uses `source={{ html: TERMINAL_HTML }}` (`mobile/src/screens/TerminalScreen.tsx:163-177`)
- calls `window.initTerminal(wsUrl)` via `injectedJavaScript` (`mobile/src/screens/TerminalScreen.tsx:108-113`)
- expects `postMessage({ type: 'connected' })` etc.

Change only the WebView `source`:

```ts
// Before:
source={{ html: TERMINAL_HTML }}

// After:
source={{ html: getTerminalHtml() }}
```

Important: the demo HTML should still expose `window.initTerminal(url)` and should `postMessage` the same `{ type: 'connected' | 'disconnected' | 'error' }` events so `TerminalScreen` stays unchanged.

### 5. `mobile/src/screens/SettingsScreen.tsx`
Optional: show a small “Demo Mode” badge + quick exit.

This screen already owns server config editing (`mobile/src/screens/SettingsScreen.tsx:674-705`). You can *exit demo mode* simply by changing the hostname away from `perry-demo` and tapping “Update Server”.

If you want a clearer reviewer UX, add:
- a tiny badge in the “Connection” card when `isDemoMode()` is true
- an “Exit Demo Mode” button that resets host/port to empty (or navigates to Setup), implemented by calling `saveServerConfig()` with a non-demo host or clearing storage

## Demo Driver Coverage (based on current mobile code)

The current mobile UI calls the following `api.*` methods (see `mobile/src/screens/*` and `mobile/src/components/RepoSelector.tsx`). The demo driver should implement these so reviewers don’t hit dead ends:

- `getInfo()` (also used by `NetworkProvider` for connection status)
- `getHostInfo()` (recommend `enabled: false` in demo so “host machine” row doesn’t appear)
- `listWorkspaces()`, `getWorkspace(name)`
- `createWorkspace({ name, clone? })` (nice to support; Home screen uses it)
- `startWorkspace(name)`, `stopWorkspace(name)`, `deleteWorkspace(name)`
- `syncWorkspace(name)`, `syncAllWorkspaces()`
- `cloneWorkspace(sourceName, cloneName)`
- `listSessions(workspaceName, agentType?, limit?, offset?)`
- `getSession(workspaceName, sessionId, agentType?, limit?, offset?, projectPath?)`
- `recordSessionAccess(workspaceName, sessionId, agentType)` (can be a no-op)
- `listModels(agentType, workspaceName?)`
- `getAgents()`, `updateAgents()`
- `getCredentials()`, `updateCredentials()`
- `getScripts()`, `updateScripts()`
- `listGitHubRepos(...)` (recommend returning `{ configured: false }` so UI falls back to manual repo input)

Implementation tip: keep demo state in-memory with small, predictable mutations (start/stop/create/delete/clone). Persisting demo workspace state is optional; the *demo flag* should be persisted.

## Demo Chat Script

Pre-scripted conversation showing realistic agent interaction:

```
[User sends any message]

→ session_started: { sessionId: "demo-session-1" }
→ user: { content: <user's message> }
→ assistant: { content: "I'll help you with that. Let me " } (streamed)
→ assistant: { content: "check the project structure first." }
→ tool_use: { toolName: "Glob", toolId: "1", content: { pattern: "**/*.ts" } }
→ tool_result: { toolId: "1", content: "src/index.ts\nsrc/utils.ts\nsrc/config.ts" }
→ assistant: { content: "I found 3 TypeScript files. Let me read the main entry point." }
→ tool_use: { toolName: "Read", toolId: "2", content: { path: "src/index.ts" } }
→ tool_result: { toolId: "2", content: "// Demo project\nexport function main() {\n  console.log('Hello');\n}" }
→ assistant: { content: "This is a simple project with a main entry point..." }
→ done
```

Timing: ~50-100ms between chunks for realistic feel.

## Demo Terminal Commands

```
$ ls
README.md  package.json  src/  node_modules/

$ pwd
/home/demo/demo-project

$ cat README.md
# Demo Project
This is a sample project for demonstration.

$ cd src
(changes prompt to ~/demo-project/src $)

$ ls
index.ts  utils.ts  config.ts

$ echo "hello"
hello

$ node --version
v20.10.0

$ git status
On branch main
nothing to commit, working tree clean

$ <unknown command>
demo: command not available in demo mode
```

## Implementation Order

1. **Create demo fixtures** (`mobile/src/lib/demo/data.ts`) - workspaces, sessions, models
2. **Refactor `api.ts`** - persist demo flag in server config + route `api.*` to drivers
3. **Add chat socket factory** - `createChatWebSocket()` + update `SessionChatScreen`
4. **Implement demo chat socket** (`mobile/src/lib/demo/chat.ts`) - WebSocket-compatible mock
5. **Implement demo terminal HTML** (`mobile/src/lib/demo/terminal-html.ts`) - self-contained mock that keeps `TerminalScreen` unchanged
6. **Update `TerminalScreen`** - `source={{ html: getTerminalHtml() }}`
7. **Optional Settings UX** - badge + quick exit
8. **Manual QA** - run through create/start/stop/chat/terminal flows in demo and real modes

## Summary of Bifurcation

| Location | Demo-aware? | What it does |
|----------|-------------|--------------|
| `mobile/src/lib/api.ts` | **Yes** | Detects persisted demo config and routes to real vs demo drivers |
| `mobile/src/screens/SettingsScreen.tsx` | Optional | Displays demo badge / offers quick exit |
| All other screens | No | Continue calling `api.*` and helper factories; no demo branching |

## Verification

```bash
# Build and run on simulator
cd mobile && bun install
npx expo start --ios  # or --android

# Test demo mode
1. Enter "perry-demo" as host
2. Verify workspaces list appears (demo-project, experiment)
3. Tap demo-project → verify sessions list
4. Start new chat → send message → verify streaming response with tools
5. Open terminal → run ls, pwd, cat → verify responses
6. Go to settings → optionally show "Demo Mode" indicator
7. Exit demo mode → either tap "Exit Demo Mode" (if implemented) or change Hostname away from `perry-demo` and tap "Update Server"

# Test real mode still works
1. Enter real server host
2. Verify normal functionality unchanged
```

## Notes for App Store Submission

In "Notes for Reviewer" field:
> Enter `perry-demo` as the server address to access demo mode. This demonstrates chat with AI assistants and terminal access without requiring server infrastructure.
