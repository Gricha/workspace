# Getting Started

This guide covers installing and running the Workspace agent with its web UI.

## Prerequisites

- Docker Engine or Docker Desktop
- Node.js 18+ or Bun runtime
- SSH client

## Installation

### From npm

```bash
npm install -g @subroutinecom/workspace
```

### From source

```bash
git clone https://github.com/subroutinecom/workspace.git
cd workspace
bun install
bun run build
```

## Building the Workspace Image

Before creating workspaces, build the base Docker image:

```bash
ws build
```

This builds `workspace:latest` with all development tools pre-installed.

## Starting the Agent

The agent provides an HTTP API and web UI for managing workspaces:

```bash
ws agent start
```

By default, the agent runs on port 8420. Access the web UI at `http://localhost:8420`.

### Agent Options

```bash
ws agent start --port 3000     # Custom port
ws agent start --host 0.0.0.0  # Listen on all interfaces
ws agent stop                  # Stop the agent
ws agent status                # Check if agent is running
```

## Creating Your First Workspace

### Via Web UI

1. Open `http://localhost:8420`
2. Click the "+" button on the Workspaces page
3. Enter a name (e.g., "myproject")
4. Optionally provide a Git repository URL to clone
5. Click "Create"

### Via CLI

```bash
ws create myproject
ws create myproject --clone git@github.com:user/repo.git
```

## Managing Workspaces

### Web UI

The Workspaces page shows all workspaces with their status:
- **Running** (green): Workspace is active
- **Stopped** (gray): Container is stopped
- **Creating** (orange): Workspace is being set up
- **Error** (red): Something went wrong

Click a workspace card to view details, logs, or open a terminal.

### CLI

```bash
ws list              # List all workspaces
ws start myproject   # Start a stopped workspace
ws stop myproject    # Stop a running workspace
ws delete myproject  # Delete workspace and its data
ws logs myproject    # View container logs
```

## Accessing Workspaces

### SSH

Each workspace exposes SSH on a dynamically assigned port (2200-2400 range). Find the port in the workspace details:

```bash
ssh -p 2201 workspace@localhost
```

### Web Terminal

Click the "Terminal" button on a workspace's detail page to open an interactive terminal in your browser.

## Next Steps

- [Configure Coding Agents](./agents.md) for AI-assisted development
- [Set up Environment Variables](./configuration.md) and credentials
- [Troubleshoot Issues](./troubleshooting.md) if something goes wrong
