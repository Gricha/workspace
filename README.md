# Workspace

[![Tests](https://github.com/subroutinecom/workspace/actions/workflows/test.yml/badge.svg)](https://github.com/subroutinecom/workspace/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/@subroutinecom%2Fworkspace.svg)](https://www.npmjs.com/package/@subroutinecom/workspace)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Isolated, self-hosted workspaces accessible over Tailscale. AI coding agents, web UI, and remote terminal access.

## Features

- **AI Coding Agents** - Claude Code, OpenCode, GitHub Copilot pre-installed
- **Self-Hosted** - Run on your own hardware, full control
- **Remote Access** - Use from anywhere via Tailscale, CLI, web, or SSH
- **Web UI** - Manage workspaces from your browser
- **Isolated Environments** - Each workspace runs in its own container

## Setup

### Install

```bash
npm install -g @subroutinecom/workspace
```

Or with curl:

```bash
curl -fsSL https://workspace.subroutine.com/install.sh | sh
```

### Build Base Image

```bash
ws build
```

### Start Agent

```bash
ws agent start
```

Web UI: **http://localhost:7391**

The agent runs on port 7391 by default. For remote access:

```bash
ws agent start --host 0.0.0.0
```

### Create & Use Workspaces

**Via CLI:**

```bash
# Create workspace
ws create myproject

# Or clone a repo
ws create myproject --clone git@github.com:user/repo.git

# SSH into workspace
ws list  # Find SSH port
ssh -p 2201 workspace@localhost

# Manage workspaces
ws start myproject
ws stop myproject
ws delete myproject
```

**Via Web UI:**

Open http://localhost:7391 and click "+" to create a workspace.

## Security

Workspace is designed for use within **secure networks** like [Tailscale](https://tailscale.com). The web UI and API have no authentication, making them ideal for private networks where you can safely access workspaces remotely without additional security concerns.

For public internet exposure, place behind a reverse proxy with authentication.

## Configuration

Configure credentials and environment variables via Web UI → Settings or edit `~/.workspace-agent/config.yaml`:

```yaml
credentials:
  env:
    ANTHROPIC_API_KEY: "sk-ant-..."
    OPENAI_API_KEY: "sk-..."
    GITHUB_TOKEN: "ghp_..."
  files:
    ~/.ssh/id_ed25519: ~/.ssh/id_ed25519
    ~/.gitconfig: ~/.gitconfig
```

Restart workspaces to apply changes.

## What's Inside Each Workspace

- Ubuntu 24.04 LTS
- Node.js 22, Python 3, Go
- Docker (for containerized development)
- Neovim + LazyVim
- Git, GitHub CLI, ripgrep, fd-find, jq
- Claude Code, OpenCode, Codex CLI

## Commands

```bash
# Agent
ws agent start [--port PORT] [--host HOST]
ws agent stop
ws agent status

# Workspaces
ws create <name> [--clone URL]
ws start <name>
ws stop <name>
ws delete <name>
ws list
ws logs <name> [-f]

# Build
ws build [--no-cache]
ws doctor
```

## Documentation

Full docs at https://workspace.subroutine.com/docs

Or run locally:

```bash
cd docs
npm install
npm start
```

## Development

```bash
git clone https://github.com/subroutinecom/workspace.git
cd workspace
bun install
bun run build
```

Run tests:

```bash
bun run validate  # Lint, typecheck, build, test
bun run test      # Tests only
```

## License

MIT
