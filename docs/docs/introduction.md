---
sidebar_position: 1
---

# Introduction

**Workspace** is a containerized development environment manager that leverages Docker-in-Docker to create isolated, fully-featured development workspaces. Each workspace is a complete Linux environment with development tools, SSH access, and AI coding assistants pre-installed.

## Why Workspace?

Modern software development requires complex toolchains, multiple runtime environments, and consistent setups across team members. Workspace solves these challenges by:

- **Isolation**: Each workspace runs in its own container with Docker-in-Docker, preventing conflicts between projects
- **Reproducibility**: Identical environments for all team members, from local development to CI/CD
- **Pre-configured Tools**: Comes with Node.js, Python, Go, Docker, and popular development tools
- **AI-Ready**: Pre-installed Claude Code, OpenCode, and GitHub Copilot support
- **Remote Access**: Access workspaces from anywhere via Web UI, CLI, or SSH
- **Persistent Storage**: Workspace data persists across container restarts

## Key Features

### Distributed Architecture

Run workspaces on any machine and access them from anywhere:

- **Agent Daemon**: Long-running process that manages workspaces
- **Web UI**: Browser-based interface for workspace management
- **CLI**: Command-line tool for power users
- **TUI**: Terminal-based interactive dashboard
- **API**: oRPC-based HTTP API for programmatic access

### AI Coding Assistants

Workspaces come pre-configured with:

- **Claude Code**: Anthropic's AI coding assistant
- **OpenCode**: OpenAI-compatible coding assistant
- **GitHub Copilot**: GitHub's AI pair programmer

Configure credentials once in the agent, and they're available in all workspaces.

### Docker-in-Docker

Each workspace runs Docker inside the container, enabling:

- Building and running containerized applications
- Testing Docker Compose stacks
- CI/CD pipeline development
- Multi-container development workflows

### Flexible Access

Access workspaces through multiple interfaces:

- **SSH**: Direct terminal access via dynamically assigned ports
- **Web Terminal**: Browser-based terminal with xterm.js
- **API**: Programmatic access for automation
- **Port Forwarding**: Expose container ports to your local machine

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│           Worker Machine                     │
│  ┌────────────────────────────────────────┐ │
│  │      Agent Daemon (Port 8420)          │ │
│  │  ┌──────────┐  ┌──────────────────┐   │ │
│  │  │ HTTP API │  │ WebSocket/Terminal│   │ │
│  │  └──────────┘  └──────────────────┘   │ │
│  │                                        │ │
│  │  ┌─────────────────────────────────┐  │ │
│  │  │     Docker Engine               │  │ │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐    │  │ │
│  │  │  │ WS 1 │ │ WS 2 │ │ WS 3 │    │  │ │
│  │  │  └──────┘ └──────┘ └──────┘    │  │ │
│  │  └─────────────────────────────────┘  │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
           ▲
           │ HTTP/WebSocket
    ┌──────┼──────┬──────┐
    │      │      │      │
┌───▼──┐ ┌─▼───┐ ┌▼────┐│
│ CLI  │ │ Web │ │ TUI ││
│      │ │ UI  │ │     ││
└──────┘ └─────┘ └─────┘│
```

## Use Cases

### Team Development

- Share workspace configurations via `.workspace.yml`
- Identical development environments across team members
- No more "works on my machine" issues

### Remote Development

- Run workspaces on powerful remote machines
- Access from laptop, browser, or mobile
- Low-latency terminal access via SSH

### CI/CD Development

- Test CI workflows locally with Docker-in-Docker
- Reproduce build environments exactly
- Debug pipeline issues in isolation

### Learning and Experimentation

- Spin up isolated environments for learning new technologies
- Test breaking changes without affecting your host system
- Quick cleanup with `ws delete`

## What's Inside Each Workspace

Every workspace container includes:

- **OS**: Ubuntu 24.04 LTS
- **Languages**: Node.js 22, Python 3, Go
- **Container Tools**: Docker CE, Docker Compose, BuildKit
- **Editor**: Neovim with LazyVim configuration
- **CLI Tools**: Git, GitHub CLI, ripgrep, fd-find, jq, curl, wget
- **AI Assistants**: Claude Code, OpenCode, Codex CLI
- **User**: `workspace` user with passwordless sudo

## Next Steps

Ready to get started? Choose your path:

- [**Quick Start**](./quick-start.md) - Get up and running in 5 minutes
- [**Getting Started**](./getting-started.md) - Comprehensive installation guide
- [**Core Concepts**](./concepts/workspaces.md) - Understand how Workspace works
- [**Configuration**](./configuration/overview.md) - Configure credentials and settings
