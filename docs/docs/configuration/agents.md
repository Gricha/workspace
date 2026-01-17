---
sidebar_position: 3
---

# Agents

Configure tokens and defaults for Claude Code, OpenCode, Codex CLI, and GitHub.

## Claude Code

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

Generate a token with:

```bash
claude setup-token
```

Perry also copies `~/.claude/.credentials.json` when present.

## OpenCode

```json
{
  "agents": {
    "opencode": {
      "zen_token": "zen_...",
      "model": "opencode/claude-sonnet-4",
      "server": {
        "hostname": "0.0.0.0",
        "username": "opencode",
        "password": "your-password"
      }
    }
  }
}
```

Perry starts `opencode serve` inside workspaces on port 4096 when the `opencode` binary is available. Tokens enable API access and model selection.

## Codex CLI

Perry copies `~/.codex/` if it exists on the host.

## GitHub token

```json
{
  "agents": {
    "github": {
      "token": "ghp_..."
    }
  }
}
```

This sets `GITHUB_TOKEN` inside the workspace.

## Apply changes

Restart or sync a workspace:

```bash
perry sync myproject
```
