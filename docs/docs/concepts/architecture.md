---
sidebar_position: 2
---

# Architecture

Workspace uses a distributed client-server architecture, enabling remote workspace management and multi-interface access.

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Worker Machine                            │
│   ┌───────────────────────────────────────────────────┐    │
│   │              Agent Daemon (Port 8420)              │    │
│   │                                                    │    │
│   │   ┌─────────────┐  ┌─────────────────────────┐   │    │
│   │   │  HTTP API   │  │  WebSocket Terminal     │   │    │
│   │   │   (oRPC)    │  │       Server            │   │    │
│   │   └─────────────┘  └─────────────────────────┘   │    │
│   │                                                    │    │
│   │   ┌─────────────────────────────────────────┐    │    │
│   │   │     Docker Engine                       │    │    │
│   │   │  ┌─────────┐ ┌─────────┐ ┌─────────┐  │    │    │
│   │   │  │workspace│ │workspace│ │workspace│  │    │    │
│   │   │  │  -alpha │ │  -beta  │ │ -gamma  │  │    │    │
│   │   │  └─────────┘ └─────────┘ └─────────┘  │    │    │
│   │   └─────────────────────────────────────────┘    │    │
│   │                                                    │    │
│   │   ┌─────────────────────────────────────────┐    │    │
│   │   │  State & Config (JSON/YAML)             │    │    │
│   │   │  - Workspace state                      │    │    │
│   │   │  - Credentials                          │    │    │
│   │   │  - User scripts                         │    │    │
│   │   └─────────────────────────────────────────┘    │    │
│   └───────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ HTTP/WebSocket
          ┌─────────────────┼─────────────────┐
          │                 │                 │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │  CLI      │    │  Web UI   │    │   TUI     │
    │  Client   │    │  Browser  │    │  Terminal │
    └───────────┘    └───────────┘    └───────────┘
```

## Components

### Agent Daemon

The **agent** is a long-running Node.js/Bun process that manages workspaces.

**Responsibilities:**
- HTTP API server using oRPC (port 8420 default)
- WebSocket server for interactive terminals
- Docker container lifecycle management
- State persistence and configuration management
- Serving the Web UI as static files

**Location:** Runs on the worker machine (the machine with Docker)

**Storage:**
- `~/.workspace-agent/config.yaml` - Configuration
- `~/.workspace-agent/state.json` - Workspace state database
- `~/.workspace-agent/scripts/` - User scripts (optional)

**Starting the Agent:**

```bash
ws agent start                # Default port 8420
ws agent start --port 3000    # Custom port
ws agent start --host 0.0.0.0 # Listen on all interfaces
```

### API Server (oRPC)

The agent exposes a type-safe HTTP API using [oRPC](https://orpc.unnoq.com/).

**Base URL:** `http://{host}:8420/rpc`

**Key Endpoints:**
- `workspaces.*` - CRUD operations for workspaces
- `sessions.*` - AI agent session history
- `config.*` - Agent configuration management
- `terminal.*` - WebSocket terminal access

**Features:**
- Type-safe client/server communication
- Automatic TypeScript type inference
- JSON-RPC-like protocol over HTTP
- Error handling with standard codes

See [API Reference](../api/overview.md) for complete documentation.

### WebSocket Terminal Server

Provides browser-based terminal access to workspaces.

**Protocol:**
- WebSocket connection to `/rpc/terminal/{workspaceName}`
- Binary data stream (stdin/stdout)
- Control messages for resize, etc.

**Client Libraries:**
- Web UI uses xterm.js with WebGL renderer
- CLI/TUI uses node-pty for local emulation

### Web UI

Single-page React application served by the agent.

**Technology Stack:**
- React with react-router
- shadcn/ui components
- Tailwind CSS
- Vite build system
- xterm.js for terminal

**Features:**
- Workspace management (create, start, stop, delete)
- Real-time workspace status
- Integrated web terminal
- Configuration management
- AI agent session viewing

**Access:** `http://{host}:8420`

### CLI Client

Command-line interface for workspace management.

**Installation:**
```bash
npm install -g @subroutinecom/workspace
```

**Commands:**
```bash
ws create <name>      # Create workspace
ws start <name>       # Start workspace
ws stop <name>        # Stop workspace
ws delete <name>      # Delete workspace
ws list               # List all workspaces
ws logs <name>        # View logs
ws agent start/stop   # Manage agent
```

### TUI (Terminal UI)

Interactive terminal-based dashboard using OpenTUI.

**Features:**
- Navigate workspaces with keyboard
- Create/manage workspaces
- View logs and status
- Integrated terminal

**Launch:**
```bash
ws tui
```

### Workspace Containers

Each workspace is a Docker container running Docker-in-Docker.

**Base Image:** `workspace:latest`

**Contents:**
- Ubuntu 24.04 LTS
- Docker CE + Compose + BuildKit
- Node.js 22, Python 3, Go
- Neovim with LazyVim
- Claude Code, OpenCode, AI assistants
- SSH daemon on port 22

**Volumes:**
- `workspace-{name}` mounted at `/home/workspace`
- Docker-in-Docker volumes for `/var/lib/docker`

## Data Flow

### Workspace Creation

```
┌──────┐     HTTP POST      ┌───────┐
│Client│ ──────────────────>│ Agent │
└──────┘                     └───┬───┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │ Docker API   │
                          │ - Create     │
                          │ - Copy files │
                          │ - Start      │
                          └──────┬───────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │ Container    │
                          │ - Init       │
                          │ - SSH start  │
                          │ - Git clone  │
                          └──────────────┘
```

### Terminal Access

```
┌─────────┐   WebSocket    ┌───────┐
│ Web UI  │ ──────────────>│ Agent │
└─────────┘                 └───┬───┘
                                │
                                ▼
                         ┌─────────────┐
                         │ node-pty    │
                         │ (PTY spawn) │
                         └──────┬──────┘
                                │
                                ▼
                         ┌─────────────┐
                         │ docker exec │
                         │ /bin/bash   │
                         └─────────────┘
```

### Configuration Management

```
┌──────┐   Update Config   ┌───────┐
│Client│ ─────────────────>│ Agent │
└──────┘                    └───┬───┘
                                │
                                ▼
                      ┌──────────────────┐
                      │ config.yaml      │
                      │ - Write          │
                      │ - Validate       │
                      └──────────────────┘
                                │
                                ▼
                      ┌──────────────────┐
                      │ Next workspace   │
                      │ start injects    │
                      │ new credentials  │
                      └──────────────────┘
```

## State Management

### Agent State

Stored in `~/.workspace-agent/state.json`:

```json
{
  "workspaces": {
    "myproject": {
      "name": "myproject",
      "status": "running",
      "containerId": "abc123...",
      "created": "2025-01-04T10:30:00Z",
      "ports": {
        "ssh": 2201
      }
    }
  }
}
```

Uses `proper-lockfile` for concurrent access safety.

### Workspace State

Each workspace maintains state in:
- Docker container metadata
- Persistent volume data
- AI agent session files

## Security Model

### Authentication

Currently: **None** at the network level

- Agent API is unauthenticated
- Intended for use on trusted networks (localhost, Tailscale)
- Future: Bearer tokens, mTLS

### Credential Injection

Credentials are injected during container creation:

1. Environment variables set via Docker API
2. Files copied via `docker cp` before container start
3. File permissions set appropriately (SSH keys get 600)

### Isolation

- Workspaces cannot access host filesystem except configured mounts
- Docker-in-Docker provides network isolation
- No shared Docker daemon (each workspace has its own)

## Scalability

### Current Limitations

- Single agent per machine
- No load balancing
- No cross-machine workspace migration
- State stored in local JSON file

### Future Enhancements

- Multi-worker support
- Distributed state storage
- Load balancing across workers
- Workspace migration between hosts

## Next Steps

- [Understand Docker-in-Docker](./docker-in-docker.md)
- [Explore the API](../api/overview.md)
- [Configure the Agent](../configuration/overview.md)
