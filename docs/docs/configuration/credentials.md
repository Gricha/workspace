---
sidebar_position: 2
---

# Credentials

Perry can inject environment variables, copy files, and manage SSH keys for workspace access and git operations.

## Environment variables

```json
{
  "credentials": {
    "env": {
      "ANTHROPIC_API_KEY": "sk-ant-...",
      "OPENAI_API_KEY": "sk-...",
      "DATABASE_URL": "postgres://..."
    }
  }
}
```

Environment variables are written to `/etc/environment` inside the workspace.

## Files and directories

```json
{
  "credentials": {
    "files": {
      "~/.gitconfig": "~/.gitconfig",
      "~/.ssh/id_ed25519": "~/.ssh/id_ed25519",
      "~/.ssh/id_ed25519.pub": "~/.ssh/id_ed25519.pub",
      "~/.aws": "~/.aws"
    }
  }
}
```

Format: destination-in-container -> source-on-host.

## SSH keys

Auto-authorization is enabled by default. You can also manage keys explicitly:

```bash
perry ssh list
perry ssh show
perry ssh copy ~/.ssh/id_ed25519
perry ssh authorize ~/.ssh/id_ed25519.pub
```

You can scope keys to a specific workspace:

```bash
perry ssh copy ~/.ssh/id_ed25519 -w myproject
```

Authorized keys control SSH access to workspaces. Copied keys are available inside the workspace for git operations and tooling. By default, Perry auto-authorizes keys from `~/.ssh/` and `~/.ssh/authorized_keys` on the host.

## Apply changes

- New workspaces pick up changes immediately.
- Running workspaces require `perry sync <name>`.
- Stopped workspaces apply changes on next start.

## Security notes

- `config.json` stores values in plain text.
- Credentials are visible inside the container.
