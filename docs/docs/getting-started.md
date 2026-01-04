---
sidebar_position: 2
---

# Getting Started

This guide covers installing and running the Workspace agent with its web UI.

## Prerequisites

Before installing Workspace, ensure you have:

- **Docker Engine or Docker Desktop** - [Install Docker](https://docs.docker.com/get-docker/)
- **Node.js 18+** or **Bun runtime** - [Install Node.js](https://nodejs.org/) or [Install Bun](https://bun.sh/)
- **SSH client** - Pre-installed on macOS/Linux, [install on Windows](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)

Verify your setup:

```bash
docker --version
node --version  # or bun --version
ssh -V
```

Run the doctor command after installation to check all prerequisites:

```bash
ws doctor
```

## Installation

### From npm

Install globally using npm:

```bash
npm install -g @subroutinecom/workspace
```

Or using Bun:

```bash
bun install -g @subroutinecom/workspace
```

Verify installation:

```bash
ws --version
```

### From Source

For development or the latest features:

```bash
git clone https://github.com/subroutinecom/workspace.git
cd workspace
bun install
bun run build
bun link
```

## Building the Workspace Image

Before creating workspaces, build the base Docker image. This image includes all development tools and is reused for every workspace you create.

```bash
ws build
```

This builds `workspace:latest` with:
- Ubuntu 24.04 LTS
- Node.js 22, Python 3, Go
- Docker CE + Compose + BuildKit
- Neovim with LazyVim
- Git, GitHub CLI, and common CLI tools
- Claude Code, OpenCode, and other AI assistants

The build takes a few minutes but only needs to be done once. Rebuild when you want to update tools:

```bash
ws build --no-cache
```

## Starting the Agent

The agent provides an HTTP API and web UI for managing workspaces:

```bash
ws agent start
```

By default, the agent runs on port 8420. Access the web UI at `http://localhost:8420`.

### Agent Options

Customize the agent behavior:

```bash
ws agent start --port 3000     # Custom port
ws agent start --host 0.0.0.0  # Listen on all interfaces (for remote access)
ws agent stop                  # Stop the agent
ws agent status                # Check if agent is running
```

The agent stores its configuration and state in `~/.workspace-agent/`:

```
~/.workspace-agent/
├── config.yaml       # Agent configuration
├── state.json        # Workspace state database
└── scripts/          # User scripts (optional)
```

## Creating Your First Workspace

### Via Web UI

1. Open `http://localhost:8420`
2. Click the "+" button on the Workspaces page
3. Enter a name (e.g., "myproject")
4. Optionally provide a Git repository URL to clone
5. Click "Create"

The workspace will be created and started automatically. You'll see status indicators as it:
- Creates the Docker container
- Injects credentials and environment variables
- Clones the repository (if specified)
- Runs post-start scripts
- Starts SSH daemon

### Via CLI

Create an empty workspace:

```bash
ws create myproject
```

Create and clone a repository:

```bash
ws create myproject --clone git@github.com:user/repo.git
```

The workspace name must be unique and can contain lowercase letters, numbers, and hyphens.

## Managing Workspaces

### Web UI

The Workspaces page shows all workspaces with their status:
- **Running** (green): Workspace is active and accessible
- **Stopped** (gray): Container is stopped
- **Creating** (orange): Workspace is being set up
- **Error** (red): Something went wrong

Click a workspace card to view:
- Container logs
- Resource usage (CPU, memory)
- SSH connection details
- Open a web terminal

### CLI Commands

Manage workspaces from the command line:

```bash
ws list              # List all workspaces
ws start myproject   # Start a stopped workspace
ws stop myproject    # Stop a running workspace
ws delete myproject  # Delete workspace and its data
ws logs myproject    # View container logs
ws logs myproject -f # Follow logs in real-time
```

## Accessing Workspaces

### SSH Access

Each workspace exposes SSH on a dynamically assigned port (2200-2400 range). Find the port in the workspace details:

```bash
ws list
# Output:
# myproject  running  ssh://localhost:2201

ssh -p 2201 workspace@localhost
```

The default user is `workspace` with passwordless sudo access. SSH keys from `~/.ssh/` are automatically copied to workspaces if configured.

### Web Terminal

Click the "Terminal" button on a workspace's detail page to open an interactive terminal in your browser. The web terminal uses xterm.js with:
- Full VT100 emulation
- Copy/paste support
- Resizable interface
- Multiple concurrent sessions

### Direct Container Access

For debugging, you can access the container directly:

```bash
docker exec -it workspace-myproject bash
```

## Configuration

### Environment Variables

Set environment variables available in all workspaces:

1. Go to Settings > Environment in the web UI
2. Add key-value pairs (e.g., `ANTHROPIC_API_KEY`, `DATABASE_URL`)
3. Save

Or edit `~/.workspace-agent/config.yaml`:

```yaml
credentials:
  env:
    ANTHROPIC_API_KEY: "sk-ant-..."
    DATABASE_URL: "postgres://..."
```

### Credential Files

Copy SSH keys, git configs, or other files into workspaces:

1. Go to Settings > Files
2. Add mappings: destination → source
3. Save

Example configuration:

```yaml
credentials:
  files:
    ~/.ssh/id_ed25519: ~/.ssh/id_ed25519
    ~/.gitconfig: ~/.gitconfig
```

See [Configuration](./configuration/overview.md) for comprehensive options.

## Next Steps

Now that you have Workspace running:

- [**Configure AI Agents**](./agents/overview.md) - Set up Claude Code, OpenCode, etc.
- [**Learn Core Concepts**](./concepts/workspaces.md) - Understand the architecture
- [**Explore Configuration**](./configuration/overview.md) - Customize your setup
- [**Troubleshoot Issues**](./troubleshooting.md) - Fix common problems
