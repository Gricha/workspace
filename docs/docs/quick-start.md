---
sidebar_position: 3
---

# Quick Start

Get up and running with Workspace in 5 minutes.

## Install

```bash
npm install -g @subroutinecom/workspace
```

## Build the Base Image

```bash
ws build
```

This builds the `workspace:latest` Docker image with all development tools.

## Start the Agent

```bash
ws agent start
```

The agent runs on port 8420 by default. Access the web UI at [http://localhost:8420](http://localhost:8420).

## Create a Workspace

### Via Web UI

1. Open [http://localhost:8420](http://localhost:8420)
2. Click the "+" button
3. Enter a workspace name (e.g., "myproject")
4. Optionally provide a Git repository URL
5. Click "Create"

### Via CLI

```bash
ws create myproject
```

Or clone a repository:

```bash
ws create myproject --clone git@github.com:user/repo.git
```

## Access Your Workspace

### SSH

Find the SSH port in the workspace details, then:

```bash
ssh -p 2201 workspace@localhost
```

### Web Terminal

Click the "Terminal" button on the workspace detail page.

## Manage Workspaces

```bash
ws list              # List all workspaces
ws start myproject   # Start a stopped workspace
ws stop myproject    # Stop a running workspace
ws delete myproject  # Delete workspace and data
ws logs myproject    # View container logs
```

## Configure AI Assistants (Optional)

To enable Claude Code or other AI assistants:

1. Go to Settings > Agents in the web UI
2. Add your API keys or OAuth tokens
3. Credentials are automatically available in all workspaces

See [AI Coding Agents](./agents/overview.md) for detailed setup.

## Next Steps

- **[Configure Environment Variables](./configuration/environment-variables.md)** - Add API keys and secrets
- **[Set Up AI Assistants](./agents/overview.md)** - Enable Claude Code, OpenCode, etc.
- **[Learn Core Concepts](./concepts/workspaces.md)** - Understand how Workspace works
- **[Explore the Web UI](./guides/web-ui.md)** - Master the browser interface
