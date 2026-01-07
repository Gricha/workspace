---
sidebar_position: 1
---

# Configuration Overview

Perry stores configuration in `~/.config/perry/`.

## Configuration Files

| File | Purpose |
|------|---------|
| `config.json` | Agent configuration (credentials, SSH keys, scripts) |
| `client.json` | Client configuration (worker hostname) |
| `state.json` | Workspace state (managed automatically) |

## Agent Configuration

Location: `~/.config/perry/config.json`

```json
{
  "port": 7391,
  "credentials": {
    "env": {
      "ANTHROPIC_API_KEY": "sk-ant-...",
      "DATABASE_URL": "postgres://..."
    },
    "files": {
      "~/.gitconfig": "~/.gitconfig"
    }
  },
  "agents": {
    "github": {
      "token": "ghp_..."
    },
    "claude_code": {
      "oauth_token": "..."
    },
    "opencode": {
      "zen_token": "..."
    }
  },
  "ssh": {
    "autoAuthorizeHostKeys": true,
    "global": {
      "copy": ["~/.ssh/id_ed25519"],
      "authorize": ["~/.ssh/id_ed25519.pub"]
    },
    "workspaces": {}
  },
  "scripts": {
    "post_start": "~/.config/perry/scripts/post-start.sh"
  },
  "allowHostAccess": true
}
```

## Edit Configuration

**Option 1: Web UI**

Go to http://localhost:7391 and click Settings.

**Option 2: Edit file directly**

```bash
$EDITOR ~/.config/perry/config.json
```

**Option 3: CLI commands**

```bash
perry config show
perry config agent
perry ssh copy ~/.ssh/id_ed25519
```

## Apply Changes

Configuration changes take effect:
- **Immediately** for new workspaces
- **On sync** for running workspaces: `perry sync <name>`
- **On restart** for stopped workspaces

## Client Configuration

Location: `~/.config/perry/client.json`

```json
{
  "worker": "myserver.tail1234.ts.net:7391"
}
```

Set via CLI:

```bash
perry config worker myserver.tail1234.ts.net
```

## Configuration Sections

- [Environment Variables](./environment.md) - Inject env vars into workspaces
- [Files](./files.md) - Copy files into workspaces
- [GitHub](./github.md) - GitHub token and SSH key setup
- [AI Agents](./ai-agents.md) - Claude Code, OpenCode, Codex CLI
- [Tailscale](./tailscale.md) - Remote access via Tailscale
