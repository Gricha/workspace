<p align="center">
  <img src="assets/logo.png" alt="Perry" width="200">
</p>

<h1 align="center">Perry</h1>

<p align="center">
  <a href="https://gricha.github.io/perry/"><img src="https://img.shields.io/badge/docs-docusaurus-blue" alt="Documentation"></a>
  <a href="https://github.com/gricha/perry/actions/workflows/test.yml"><img src="https://github.com/gricha/perry/actions/workflows/test.yml/badge.svg" alt="Tests"></a>
  <a href="https://github.com/gricha/perry/releases"><img src="https://img.shields.io/github/v/release/gricha/perry" alt="Release"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

<p align="center">
  Self-hosted workspaces with AI coding agents, accessible from anywhere over Tailscale.
</p>

## Overview

Perry is an agent (agent P) designed to run as a daemon on your machine. It auto-registers containerized workspaces on your Tailscale network so your CLI, web UI, or SSH clients can connect directly.

It can be connected directly to your host, or it can create docker containers so that your work can be fully isolated.

Continue your sessions from any device on your tailnet.

**[Get Started →](https://gricha.github.io/perry/docs/getting-started)**

## Features

- **AI Coding Agents** - Claude Code, OpenCode, Codex CLI pre-installed
- **Self-Hosted** - Run on your own hardware, full control
- **Remote Access** - Use from anywhere via CLI, web, or SSH over Tailscale
- **Isolated Environments** - Each workspace runs in its own container

## Setup

### Install

```bash
curl -fsSL https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash
```

### Start Agent

```bash
perry agent run
```

## Access From Anywhere

Once your agent is running, connect from any device on your Tailscale network.

### CLI

The fastest way to access workspaces from any machine:

```bash
# Point to your agent (one-time setup)
perry config agent <hostname>

# Create workspace and clone a repo
perry start my-proj --clone git@github.com:user/repo.git

# Shell into the workspace
perry shell my-proj

# Or attach an AI coding agent directly
opencode attach http://my-proj:4096
```

### Web UI

Open `http://<hostname>:7391` to manage workspaces from your browser.

<p align="center">
  <img src="assets/demo.gif" alt="Web UI Demo" width="800">
</p>

### Remote Access

Each workspace is registered on your tailnet, so you can connect directly using CLI, web UI, or SSH.

### Agent Workflows

- OpenCode: https://gricha.github.io/perry/docs/workflows/opencode
- Claude Code + Codex: https://gricha.github.io/perry/docs/workflows/claude-code

### Mobile

Mobile apps are not yet in app stores. You can build them from source for quick workspace management and terminal access.

## Security

Perry is designed for use within **secure private networks** like [Tailscale](https://tailscale.com). The web UI and API currently have no authentication - this is intentional for private network use where all devices are trusted.

NOTE: Using this software can be dangerous, don't expose it on the network. Any user that can access perry's web server may be able to do serious damage to your system. Keep it closed in Tailscale network.

Perry by default allows the API to interact with the host machine as well - while it's intended purpose is to manage docker containers, sometimes, for simplicity I run some of my jobs directly on my machine. This can be disabled. When you start perry, you can pass a `--no-host-access` flag.

`perry agent run --no-host-access`

This will ensure that perry can only stand up/tear down docker containers. While this reduces the attack surface, it is only as good as docker is as sandbox (and it may very well not be).

## Configuration

Configure credentials and agent settings via Web UI → Settings or edit `~/.config/perry/config.json`:

```json
{
  "credentials": {
    "env": {},
    "files": {
      "~/.ssh/id_ed25519": "~/.ssh/id_ed25519",
      "~/.gitconfig": "~/.gitconfig"
    }
  },
  "agents": {
    "github": {
      "token": "ghp_..."
    },
    "opencode": {
      "server": {
        "hostname": "0.0.0.0"
      }
    }
  }
}
```

Perry syncs agent credentials from the host machine (Claude Code and OpenCode configs) when present.

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
perry agent run [--port PORT]
perry agent status

# Workspaces
perry start <name> [--clone URL]
perry start <name>
perry stop <name>
perry delete <name>
perry list
perry shell <name>
perry logs <name>
```

## Development

```bash
git clone https://github.com/gricha/perry.git
cd perry
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

## Support

Perry is not endorsing or associated with any crypto tokens or meme coins. If you'd like to support the project, the best way is to donate to your favorite charity, or to St. Jude: https://www.stjude.org/donate/donate-to-st-jude.html
