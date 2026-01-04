> **VISION DOCUMENT**: This document describes the aspirational v2 architecture.
> Some features are implemented, others are planned. For current capabilities,
> see README.md. For implementation tasks, see TODO.md.

# Workspace v2: Distributed Development Environment

## Overview

Transform the workspace CLI from a local-only Docker manager into a distributed development environment orchestrator. Run workspaces on any machine, access them from anywhere—laptop, browser, or mobile.

## Core Principles

1. **Top-notch DX**: One command to set up a node. One command to create a workspace. Zero friction.
2. **Simplicity over features**: Start with single-worker model, extend later.
3. **Tailscale-invisible**: Works on Tailscale networks but doesn't require API keys or special setup.
4. **Testability**: Good tests that catch real bugs, not coverage theater.

---

## One Command Setup (DX Goal)

### Worker Setup

```bash
$ ws --agent
# First run: no config exists
Creating default config at ~/.config/workspace/config.json
Building workspace image... done
Starting agent on port 7391...
Agent running at http://my-desktop:7391

# No credentials configured yet - that's fine, add them later
```

That's it. One command, agent is running.

### Client Setup

```bash
$ ws
# First run: no worker configured
? Enter worker hostname: my-desktop.tail1234.ts.net
Connecting to my-desktop.tail1234.ts.net:7391... OK
Saved to ~/.config/workspace/client.json

# Shows TUI with empty workspace list
No workspaces. Press 'n' to create one.
```

Or non-interactively:
```bash
$ ws start alpha
? No worker configured. Enter worker hostname: my-desktop
Creating workspace 'alpha'... done
```

### Adding Credentials

Via TUI/Web UI settings, or direct config edit:
```bash
$ ws config set env.ANTHROPIC_API_KEY sk-ant-...
$ ws config set env.OPENAI_API_KEY sk-...
$ ws config set files."~/.ssh/id_ed25519" ~/.ssh/id_ed25519
```

Or edit `~/.config/workspace/config.json` directly.

---

## Architecture

### High-Level View

```
┌─────────────────────────────────────────────────────────────┐
│                    Tailscale Network                        │
│           (or any network with connectivity)                │
│                                                             │
│   ┌───────────────────────────────────────────────────┐    │
│   │              Worker Machine                        │    │
│   │                                                    │    │
│   │   ┌────────────────────────────────────────────┐  │    │
│   │   │           ws --agent (daemon)              │  │    │
│   │   │                                            │  │    │
│   │   │  ┌─────────────┐  ┌─────────────────────┐ │  │    │
│   │   │  │  HTTP API   │  │  WebSocket Terminal │ │  │    │
│   │   │  │   :7391     │  │       Server        │ │  │    │
│   │   │  └─────────────┘  └─────────────────────┘ │  │    │
│   │   │                                            │  │    │
│   │   │  ┌─────────────────────────────────────┐  │  │    │
│   │   │  │     Docker Engine                   │  │    │
│   │   │  │  ┌─────────┐ ┌─────────┐            │  │  │    │
│   │   │  │  │  alpha  │ │  beta   │  ...       │  │  │    │
│   │   │  │  └─────────┘ └─────────┘            │  │  │    │
│   │   │  └─────────────────────────────────────┘  │  │    │
│   │   │                                            │  │    │
│   │   │  ┌─────────────────────────────────────┐  │  │    │
│   │   │  │  Config & State (JSON)              │  │  │    │
│   │   │  │  - credentials (env, files)         │  │  │    │
│   │   │  │  - user scripts                     │  │  │    │
│   │   │  │  - workspace state                  │  │  │    │
│   │   │  └─────────────────────────────────────┘  │  │    │
│   │   └────────────────────────────────────────────┘  │    │
│   └───────────────────────────────────────────────────┘    │
│                            ▲                                │
│                            │ HTTP/WebSocket                 │
│          ┌─────────────────┼─────────────────┐             │
│          │                 │                 │             │
│    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐       │
│    │  Laptop   │    │  Browser  │    │   Phone   │       │
│    │   CLI     │    │  Web UI   │    │   App     │       │
│    │   TUI     │    │           │    │ (future)  │       │
│    └───────────┘    └───────────┘    └───────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Components

#### 1. Agent Daemon (`ws --agent`)

Long-running process on the worker machine. Responsibilities:
- HTTP API server (port 7391 default, configurable)
- WebSocket server for interactive terminals
- Docker container lifecycle management
- Config and state persistence
- Serves Web UI as static files

Installation:
```bash
# Manual start (foreground)
ws --agent

# Install as systemd service
ws agent install
systemctl start workspace-agent
```

#### 2. CLI Client

Commands connect to configured worker over HTTP/WebSocket:
```bash
ws start alpha                    # Create and start workspace (empty)
ws start alpha --clone=git@...    # Clone repo into workspace
ws stop alpha                     # Stop workspace
ws shell alpha                    # Interactive terminal
ws list                           # List all workspaces
ws delete alpha                   # Remove workspace
ws config                         # Manage configuration
```

#### 3. TUI Dashboard

Interactive terminal UI using OpenTUI:
```bash
ws                                # Launch TUI
```

Features:
- List all workspaces with status
- Create/start/stop/delete workspaces
- Select repository to clone (optional)
- Integrated terminal
- Config management

#### 4. Web UI

Single-page application served by agent:
- **Framework**: React + react-router + shadcn/ui
- **Runtime**: Node or Bun
- Same capabilities as TUI
- Accessible from any browser
- Terminal via xterm.js

#### 5. Mobile App (Future)

React Native + Expo application:
- Connect to worker
- View/manage workspaces
- Terminal access

---

## Data Model

### Worker Configuration

Location: `~/.config/workspace/config.json`

```json
{
  "port": 7391,
  "credentials": {
    "env": {
      "ANTHROPIC_API_KEY": "sk-ant-...",
      "OPENAI_API_KEY": "sk-...",
      "GITHUB_TOKEN": "ghp_...",
      "CLAUDE_CODE_OAUTH_TOKEN": "sk-ant-oat01-..."
    },
    "files": {
      "~/.ssh/id_ed25519": "~/.ssh/id_ed25519",
      "~/.ssh/id_ed25519.pub": "~/.ssh/id_ed25519.pub",
      "~/.gitconfig": "~/.gitconfig"
    }
  },
  "scripts": {
    "post_start": "~/.config/workspace/scripts/post-start.sh"
  }
}
```

The `files` map uses `"destination_in_container": "source_on_worker"` format.

All configured credentials are always injected into every workspace. No profiles, no selection—simple default that works.

**First-run behavior**: If config doesn't exist, create empty one with sensible defaults. Agent starts with no credentials configured—user adds them later via TUI/Web UI.

### User Scripts

Location: `~/.config/workspace/scripts/`

**post-start.sh** (runs after every workspace starts):
```bash
#!/bin/bash
# Keep coding tools up to date
claude update 2>/dev/null || true
codex update 2>/dev/null || true
opencode update 2>/dev/null || true
```

Users can customize this script for their needs.

### Client Configuration

Location: `~/.config/workspace/client.json`

```json
{
  "worker": "my-desktop.tail1234.ts.net"
}
```

### Workspace State

Location: `~/.config/workspace/state.json` (on worker)

```json
{
  "workspaces": {
    "alpha": {
      "name": "alpha",
      "status": "running",
      "containerId": "abc123def456...",
      "created": "2025-01-15T10:30:00Z",
      "repo": "git@github.com:user/project.git",
      "ports": {
        "ssh": 22001,
        "http": 22080
      }
    }
  }
}
```

---

## API Specification

The agent uses [oRPC](https://orpc.unnoq.com/) for type-safe RPC communication. oRPC provides automatic TypeScript type inference between client and server, making API calls type-safe at compile time.

### Base URL

`http://<worker>:7391/rpc`

### oRPC Router Structure

The API is organized as a nested router with the following structure:

```typescript
{
  workspaces: {
    list: () => WorkspaceInfo[]
    get: ({ name: string }) => WorkspaceInfo
    create: ({ name: string, clone?: string, env?: Record<string, string> }) => WorkspaceInfo
    delete: ({ name: string }) => { success: boolean }
    start: ({ name: string }) => WorkspaceInfo
    stop: ({ name: string }) => WorkspaceInfo
    logs: ({ name: string, tail?: number }) => string
  },
  info: () => InfoResponse,
  config: {
    credentials: {
      get: () => Credentials
      update: (Credentials) => Credentials
    },
    scripts: {
      get: () => Scripts
      update: (Scripts) => Scripts
    }
  }
}
```

### Data Types

```typescript
interface WorkspaceInfo {
  name: string
  status: 'running' | 'stopped' | 'creating' | 'error'
  containerId: string
  created: string  // ISO 8601 timestamp
  repo?: string
  ports: { ssh: number, http?: number }
}

interface InfoResponse {
  hostname: string
  uptime: number  // seconds
  workspacesCount: number
  dockerVersion: string
  terminalConnections: number
}

interface Credentials {
  env: Record<string, string>   // environment variables
  files: Record<string, string> // destination -> source path mapping
}

interface Scripts {
  post_start?: string  // path to post-start script
}
```

### Error Handling

oRPC errors use standard codes:
- `NOT_FOUND` - Workspace doesn't exist
- `CONFLICT` - Workspace name already exists
- `INTERNAL_SERVER_ERROR` - Unexpected errors

### Client Usage

```typescript
import { createORPCClient } from '@orpc/client'
import type { AppRouter } from './router'

const client = createORPCClient<AppRouter>({
  baseURL: 'http://worker:7391/rpc'
})

// Type-safe API calls
const workspaces = await client.workspaces.list()
const workspace = await client.workspaces.create({ name: 'alpha', clone: 'git@github.com:user/repo' })
await client.workspaces.stop({ name: 'alpha' })
```

### Terminal WebSocket

Terminal access is still via WebSocket (not oRPC):

```
GET /terminal/:name
Upgrade: WebSocket

Binary protocol:
- Client → Server: stdin bytes
- Server → Client: stdout bytes
- Control frames: { "type": "resize", "cols": 80, "rows": 24 }
```

---

## Credential System

### The Problem

Three categories of credentials:

1. **API Keys** (easy): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`
   - Store in config `credentials.env` section
   - Inject as environment variables

2. **Files** (medium): SSH keys, `.gitconfig`, AWS credentials
   - Store paths in config `credentials.files` section
   - Copy into workspace at creation via Docker API

3. **OAuth Tokens** (solved): Claude Code, GitHub Copilot, Codex CLI
   - **Claude Code**: Use `CLAUDE_CODE_OAUTH_TOKEN` env var (designed for containers)
     - User runs `claude setup-token` once on their machine
     - Gets long-lived token, adds to config's `credentials.env`
     - Alternative: Copy `~/.claude/.credentials.json` (Linux only, tokens portable)
   - **OpenCode**: Just needs `OPENAI_API_KEY` env var
   - **Codex CLI**: Needs research (likely similar pattern)

### Credential Flow

```
1. User creates workspace: ws start alpha

2. Agent reads credentials from config

3. Agent creates Docker container:
   - docker create with env vars from credentials.env
   - docker cp files from credentials.files into container
   - docker start

4. Container entrypoint runs:
   - Sets up SSH keys permissions
   - Starts Docker daemon (DinD)
   - Starts SSH daemon

5. Init runs (if repo specified):
   - git clone <repo>
   - Run post_start.sh script
```

### Workspace Creation Flow (Detailed)

```
User runs: ws start alpha --clone=git@github.com:user/project.git

1. Check name uniqueness → 409 if "alpha" exists
2. Allocate ports (SSH, HTTP forwarding)
3. docker create workspace-base \
     -e ANTHROPIC_API_KEY=... \
     -e OPENAI_API_KEY=... \
     -e GITHUB_TOKEN=... \
     -e CLAUDE_CODE_OAUTH_TOKEN=... \
     -e WORKSPACE_REPO_URL=git@github.com:user/project.git \
     -v workspace-alpha-home:/home/workspace \
     --privileged
4. docker cp ssh_keys/ container:/home/workspace/.ssh/
5. docker cp .gitconfig container:/home/workspace/.gitconfig
6. docker cp post-start.sh container:/workspace/post-start.sh
7. docker start container
8. Wait for healthy (SSH available)
9. Return workspace info
```

### Volume Strategy

Each workspace gets a named volume for `/home/workspace`:
- `workspace-{name}-home` - persists across container restarts
- Deleted when workspace is deleted
- Contains: cloned repos, user files, tool configs

---

## Terminal Implementation

### Basic Implementation

WebSocket connection to agent, bidirectional byte stream to container's PTY.

### Client Libraries

- CLI/TUI: node-pty for local terminal emulation
- Web UI: xterm.js with WebGL renderer
- Mobile: react-native-terminal or similar

---

## Testing Strategy

### Philosophy

- Tests catch real bugs, not checkbox compliance
- Fast feedback loop
- Real Docker, minimal mocking
- Each feature has tests before/during implementation

### Test Categories

#### Unit Tests

Pure function testing, no Docker needed:
- Config parsing and validation
- Credential resolution (path expansion, etc.)
- API request/response serialization
- Command argument parsing

Example:
```javascript
test('expandPath resolves home directory', () => {
  const result = expandPath('~/.ssh/id_ed25519', '/home/user');
  expect(result).toBe('/home/user/.ssh/id_ed25519');
});
```

#### Integration Tests

Agent + Docker, no network:
- Agent starts and serves API
- Workspace CRUD operations
- Terminal WebSocket functionality
- Credential injection

Example:
```javascript
test('creating workspace injects environment variables', async () => {
  const agent = await startAgent({ port: 0 }); // random port

  await agent.api.post('/workspaces', { name: 'test-ws' });

  const result = await agent.exec('test-ws', 'echo $GITHUB_TOKEN');
  expect(result.stdout).toBe('ghp_test123');

  await agent.cleanup();
});
```

#### E2E Tests

Full system, simulates real usage:
- Client CLI → Agent API → Docker
- TUI interaction (where feasible)
- Web UI basic flows (Playwright)

Example:
```javascript
test('full workflow: create, shell, delete', async () => {
  const agent = await startTestAgent();

  await cli('config', 'set', 'worker', `localhost:${agent.port}`);
  await cli('start', 'e2e-test');

  const result = await cli('shell', 'e2e-test', '-c', 'whoami');
  expect(result.stdout).toContain('workspace');

  await cli('delete', 'e2e-test');
  await agent.stop();
});
```

### Test Harness

```javascript
// test/helpers/agent.js
export async function startTestAgent(config = {}) {
  const port = await getRandomPort();
  const configDir = await createTempConfig(config);

  const process = spawn('node', ['src/agent/index.js'], {
    env: { ...process.env, WS_CONFIG_DIR: configDir, WS_PORT: port }
  });

  await waitForHealthy(`http://localhost:${port}`);

  return {
    port,
    api: createApiClient(`http://localhost:${port}`),
    exec: (workspace, cmd) => execInWorkspace(port, workspace, cmd),
    cleanup: async () => {
      process.kill();
      await cleanupContainers('test-');
      await fs.rm(configDir, { recursive: true });
    }
  };
}
```

### CI Considerations

- Unit tests: Run everywhere, fast
- Integration tests: Require Docker, run on Linux CI
- E2E tests: Require Docker, may need longer timeout
- Tailscale-dependent tests: Skip in CI or mock

---

## Development Phases

### Phase 0: Foundation

**Goal**: Refactor existing code, establish architecture.

Tasks:
- [ ] Extract Docker operations into reusable module
- [ ] Define TypeScript-style interfaces (JSDoc for now)
- [ ] Set up test harness
- [ ] Create project structure for new components

Tests:
- Existing tests still pass
- New test harness works

### Phase 1: Agent Daemon

**Goal**: Worker runs daemon, serves API.

Tasks:
- [ ] HTTP server with health endpoint
- [ ] Workspace CRUD endpoints
- [ ] State persistence (JSON)
- [ ] systemd service installation (`ws agent install`)

Tests:
- Agent starts and responds to health check
- Can create/list/delete workspace via API
- State persists across restart

### Phase 2: Terminal

**Goal**: Interactive terminal via WebSocket.

Tasks:
- [ ] WebSocket endpoint for terminal
- [ ] PTY management in container
- [ ] Resize handling
- [ ] Connection cleanup on disconnect

Tests:
- Can open terminal, run command, see output
- Resize works
- Multiple simultaneous terminals

### Phase 3: CLI Client

**Goal**: CLI commands work against remote worker.

Tasks:
- [ ] Client config management (`ws config`)
- [ ] Refactor commands to use API client
- [ ] `ws start`, `ws stop`, `ws list`, `ws delete`
- [ ] `ws shell` with local terminal emulation

Tests:
- CLI connects to remote agent
- All commands work end-to-end

### Phase 4: Credential System

**Goal**: Credentials injected into workspaces.

Tasks:
- [ ] Config schema and validation
- [ ] Environment variable injection
- [ ] File copying into containers
- [ ] Directory copying for OAuth tokens
- [ ] Post-start script execution

Tests:
- Env vars present in workspace
- Files copied to correct locations
- Post-start script runs

### Phase 5: TUI

**Goal**: Interactive dashboard in terminal.

Tasks:
- [ ] OpenTUI setup
- [ ] Workspace list view
- [ ] Create workspace form (with optional repo selection)
- [ ] Integrated terminal
- [ ] Config management UI

Tests:
- TUI renders without errors
- Navigation works
- Actions trigger correct API calls

### Phase 6: Web UI

**Goal**: Browser-based management.

Tasks:
- [ ] React + react-router + shadcn/ui setup
- [ ] Workspace list and management
- [ ] xterm.js terminal
- [ ] Bundle into agent (served as static files)

Tests:
- Page loads
- Workspace operations work
- Terminal functional (Playwright)

### Phase 7: Polish

**Goal**: Production-ready quality.

Tasks:
- [ ] Error handling and user feedback
- [ ] Documentation
- [ ] Docker image publishing

---

## Research Items

Items that need investigation before or during implementation:

### OAuth Token Locations & Portability (RESOLVED)

| Tool | Auth Method | Portable? | Notes |
|------|-------------|-----------|-------|
| Claude Code | `CLAUDE_CODE_OAUTH_TOKEN` env var | ✓ | Use `claude setup-token` to generate |
| Claude Code | `~/.claude/.credentials.json` | ✓ | Linux only, tokens not machine-bound |
| OpenCode | `OPENAI_API_KEY` env var | ✓ | Just API key |
| GitHub Copilot | `~/.config/github-copilot/` | TBD | Research still needed |
| Codex CLI | TBD | TBD | Research still needed |

**Recommendation**: Use `CLAUDE_CODE_OAUTH_TOKEN` for Claude Code (designed for containers/CI).

### Codex CLI Authentication (Priority: Medium)

Need to research:
- How Codex CLI authenticates
- Where tokens stored
- Portability for containers

### Terminal Latency Optimization (Priority: Low)

Research from prior art for later implementation:
- Mosh-style local echo
- Predictive rendering for common operations
- Compression strategies
- Binary protocol optimizations

### Token Usage Tracking (Priority: Medium)

Research document: [RESEARCH_TOKEN_USAGE.md](./RESEARCH_TOKEN_USAGE.md)

Track API token usage across workspaces to help users monitor costs:
- Log-based collection from workspaces
- SQLite storage on agent
- Per-agent and per-workspace breakdown
- Cost estimation based on model pricing
- Dashboard UI with time-series visualization

---

## Container Image Changes

The existing Dockerfile (`workspace/Dockerfile`) is mostly suitable. It already includes:
- Docker-in-Docker setup
- Node.js, Bun, Go, Python, etc.
- Claude Code pre-installed (`claude.ai/install.sh`)
- SSH server
- `workspace` user with sudo

### Current Host Mount Dependencies

The internal scripts (`workspace/internal/`) currently expect these host mounts:

| Mount | Current Use | New Approach |
|-------|-------------|--------------|
| `/host/home/.ssh` | Copy SSH keys | `docker cp` at creation |
| `/host/home/.gitconfig` | Copy git config | `docker cp` at creation |
| `/workspace/config/runtime.json` | Runtime config | Pass via env vars |
| `/workspace/userconfig` | User scripts | `docker cp` post-start.sh |
| `/ssh-agent` | SSH agent socket | Not needed - copy keys instead |
| `HOST_UID/HOST_GID` | Sync user IDs | Optional - already skipped if unset |

### Required Script Changes

**`workspace/internal/src/commands/add-ssh-key.ts`**:
- Currently copies from `/host/home/.ssh`
- Change: Work with pre-copied keys (already partially supports this)
- The `SSH_PUBLIC_KEY` env var path already works

**`workspace/internal/src/commands/init.ts`**:
- Currently expects runtime.json mount
- Change: Accept `WORKSPACE_REPO_URL` env var (already supports this)
- Change: Look for post-start.sh in predictable location

**`workspace/internal/src/lib/bootstrap.ts`**:
- Currently looks in `/workspace/userconfig`
- Change: Support `/workspace/post-start.sh` as simpler path

### Minimal Changes Needed

1. Make `/host/home` references optional (fallback gracefully)
2. Support env var-only configuration
3. Add predictable post-start.sh location

The good news: Most of the logic is already there, just needs relaxed assumptions about host mounts.

---

## Follow-up Items

Features explicitly deferred to later phases:

### Multi-Worker Support

Not in initial scope, but architecture should allow:
- Config lists multiple workers
- CLI can target specific worker: `ws start alpha --on=beefy-server`
- TUI/Web UI shows workspaces across workers
- Discovery via Tailscale API (optional feature)

### Mobile App (React Native + Expo)

Architecture supports it now:
- API is HTTP/WebSocket, works from mobile
- Auth: Tailscale handles network-level security
- Terminal: react-native-terminal or similar

### DevContainer Support

Potential future addition:
- Read `devcontainer.json` from repo
- Apply Features
- Provides ecosystem compatibility

### Docker Image Hosting

Currently using locally-built image. Future options:
- Host on Docker Hub / GitHub Container Registry
- Pre-pull during `ws agent install`
- Versioned releases

### Authentication Layer

Currently none (Tailscale-trusted). Future options if needed:
- Bearer tokens
- mTLS
- Integration with Tailscale ACLs

---

## Appendix: Port Selection

Default port: **7391**

Rationale:
- Not sequential (avoids 3000, 4000, 5000, 8000, 8080)
- Not used by common development tools
- Memorable enough (7-3-9-1)
- Configurable via `ws agent install --port=XXXX`

## Appendix: File Structure

```
workspace/
├── src/
│   ├── agent/
│   │   ├── index.js          # Agent entry point
│   │   ├── server.js         # HTTP/WS server
│   │   ├── docker.js         # Docker operations
│   │   ├── terminal.js       # PTY/WebSocket handling
│   │   └── state.js          # State persistence
│   ├── cli/
│   │   ├── index.js          # CLI entry point
│   │   ├── commands/         # Command implementations
│   │   └── tui/              # OpenTUI components
│   ├── client/
│   │   └── api.js            # HTTP client for agent
│   ├── config/
│   │   ├── schema.js         # Config validation
│   │   └── loader.js         # Load/save config
│   └── shared/
│       └── types.js          # Shared types/constants
├── web/                      # Web UI (separate build)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── routes/
│   │   └── components/       # shadcn/ui components
│   └── dist/                 # Built, served by agent
├── test/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── fixtures/
│   └── helpers/
├── Dockerfile
├── DESIGN.md                 # This document
└── CLAUDE.md                 # Agent instructions
```
