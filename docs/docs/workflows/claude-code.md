---
sidebar_position: 2
---

# Claude Code and Codex Workflow

Claude Code and Codex run inside workspaces. There is no external server to attach to, so you connect via a terminal and run the client in the workspace.

## 1) Configure credentials

Claude Code:

```bash
claude setup-token
```

Then set the token in Perry config:

```json
{
  "agents": {
    "claude_code": {
      "oauth_token": "sk-ant-oat01-...",
      "model": "sonnet"
    }
  }
}
```

Codex:

Perry copies `~/.codex/` from the host if it exists.

## 2) Start a workspace

```bash
perry start myproject
```

## 3) Run inside the workspace

```bash
perry shell myproject
claude
codex
```

## Ways to connect

- `perry shell` from any machine pointed at the agent
- Web UI terminal from the workspace page
- SSH directly (Tailscale) or with a client like Termius

## Sessions

The Sessions tab in the Web UI shows session history and shortcuts. Opening a session drops you into a terminal in that workspace.
