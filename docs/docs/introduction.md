---
sidebar_position: 1
---

# Introduction

Perry is a lightweight orchestration layer for development environments with AI coding agents preconfigured and synced, designed to be used over Tailscale from day one.

## What is Perry?

Perry is a self-hosted daemon that:

- **Spawns sandboxed containers** for isolated development workspaces
- **Syncs coding agents and credentials** into those workspaces
- **Provides remote access** via CLI, Web UI, or SSH over Tailscale

Think of it as your personal development environment manager that you can access from anywhere.

## Access from anywhere

Once your agent is running, you can connect from any device on your tailnet.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Devices                           │
│   Browser (Web UI)  •  CLI  •  SSH                          │
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
- **Remote access** — Tailscale-first access from any device
- **AI-ready** — coding agents are pre-installed and synced
- **Credential sync** — SSH keys, tokens, and configs available in workspaces

## Networking first

Perry assumes you want to reach workspaces remotely. With Tailscale enabled, every workspace gets a tailnet hostname and all ports are reachable directly, without extra port mapping. If you are not using Tailscale yet, you can still forward ports with `perry proxy`.

## Next Steps

1. [Quickstart](./quickstart.md)
2. [Workspaces](./workspaces.md)
3. [Configuration](./configuration/overview.md)
