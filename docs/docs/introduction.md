---
sidebar_position: 1
---

# Introduction

Perry is a lightweight orchestration layer for development environments with built-in support for AI coding agents.

## What is Perry?

Perry is a self-hosted daemon that:

- **Spawns sandboxed containers** for isolated development workspaces
- **Runs AI coding agents** (Claude Code, OpenCode, Codex) against your workspaces—or directly on the host
- **Provides remote access** via Tailscale through a responsive web app or native mobile app

Think of it as your personal development environment manager that you can access from anywhere.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Devices                           │
│   Browser (Web UI)  •  Mobile App  •  CLI  •  SSH          │
└─────────────────────────┬───────────────────────────────────┘
                          │ Tailscale / Local
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Perry Agent                             │
│   API Server  •  Container Management  •  Session Tracking │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │Workspace │    │Workspace │    │  Host    │
    │Container │    │Container │    │ Machine  │
    └──────────┘    └──────────┘    └──────────┘
```

## Key Features

- **Self-hosted** — runs on your hardware, your data stays with you
- **Container isolation** — each workspace is sandboxed with Docker-in-Docker support
- **Remote access** — work from any device via Tailscale
- **AI-ready** — coding agents pre-installed and configured
- **Credential sync** — SSH keys, API tokens, and configs automatically available in workspaces

## Next Steps

1. [Install Perry](./installation.md)
2. [Create your first workspace](./getting-started.md)
3. [Configure credentials and agents](./configuration/overview.md)
