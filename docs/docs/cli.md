---
sidebar_position: 5
---

# CLI Reference

## Agent Commands

### `perry agent run`

Start the agent daemon.

```bash
perry agent run
perry agent run --port 3000
perry agent run --config-dir ~/.my-perry
perry agent run --no-host-access
```

| Option | Description |
|--------|-------------|
| `-p, --port <port>` | Port to listen on (default: 7391) |
| `-c, --config-dir <dir>` | Configuration directory |
| `--no-host-access` | Disable direct host machine access |

### `perry agent install`

Install agent as a systemd user service.

```bash
perry agent install
perry agent install --port 3000
perry agent install --no-host-access
```

Same options as `perry agent run`.

### `perry agent uninstall`

Remove the systemd service.

```bash
perry agent uninstall
```

### `perry agent status`

Show agent service status.

```bash
perry agent status
```

### `perry agent logs`

View agent service logs.

```bash
perry agent logs
perry agent logs -f          # Follow logs
perry agent logs -n 100      # Show last 100 lines
```

| Option | Description |
|--------|-------------|
| `-f, --follow` | Follow log output |
| `-n, --lines <n>` | Number of lines to show (default: 50) |

## Workspace Commands

### `perry start <name>`

Start a workspace. Creates it if it doesn't exist.

```bash
perry start myproject
perry start myproject --clone git@github.com:user/repo.git
perry start myproject --clone https://github.com/user/repo.git
```

| Option | Description |
|--------|-------------|
| `--clone <url>` | Git repository URL to clone |

### `perry stop <name>`

Stop a running workspace.

```bash
perry stop myproject
```

### `perry delete <name>`

Delete a workspace and its data.

```bash
perry delete myproject
perry rm myproject  # alias
```

### `perry list`

List all workspaces.

```bash
perry list
perry ls  # alias
```

Output shows:
- Status indicator (running/stopped)
- Workspace name
- SSH port
- Repository (if cloned)
- Creation date

### `perry info [name]`

Show workspace or agent info.

```bash
perry info            # Agent info
perry info myproject  # Workspace info
```

### `perry logs <name>`

Show workspace container logs.

```bash
perry logs myproject
perry logs myproject -n 50  # Last 50 lines
```

| Option | Description |
|--------|-------------|
| `-n, --tail <lines>` | Number of lines to show (default: 100) |

### `perry shell <name>`

Open interactive terminal to workspace.

```bash
perry shell myproject
```

Uses direct Docker exec for local agents, WebSocket for remote agents.

### `perry sync <name>`

Re-sync credentials and files to a running workspace.

```bash
perry sync myproject
```

Use after updating configuration to apply changes without restarting.

### `perry proxy <name> [ports...]`

Forward ports from workspace to local machine.

```bash
perry proxy myproject 3000           # Forward port 3000
perry proxy myproject 8080:3000      # Local 8080 -> remote 3000
perry proxy myproject 3000 5173      # Multiple ports
```

## Build Commands

### `perry build`

Build the workspace Docker image locally.

```bash
perry build
perry build --no-cache
```

| Option | Description |
|--------|-------------|
| `--no-cache` | Build without Docker cache |

## Configuration Commands

### `perry config show`

Show current configuration.

```bash
perry config show
```

### `perry config worker [hostname]`

Get or set the worker hostname.

```bash
perry config worker                    # Show current worker
perry config worker myserver:7391      # Set worker
perry config worker myserver.ts.net    # Tailscale hostname
```

### `perry config agent`

Show agent configuration.

```bash
perry config agent
```

## SSH Commands

### `perry ssh list`

List detected SSH keys on host.

```bash
perry ssh list
```

### `perry ssh show`

Show current SSH configuration.

```bash
perry ssh show
```

### `perry ssh auto-authorize [on|off]`

Toggle auto-authorization of host keys.

```bash
perry ssh auto-authorize        # Show current setting
perry ssh auto-authorize on     # Enable
perry ssh auto-authorize off    # Disable
```

### `perry ssh copy <key-path>`

Add SSH key to copy list (for git operations).

```bash
perry ssh copy ~/.ssh/id_ed25519
perry ssh copy ~/.ssh/id_ed25519 -w myproject  # Specific workspace
```

| Option | Description |
|--------|-------------|
| `-w, --workspace <name>` | Apply to specific workspace only |

### `perry ssh authorize <key-path>`

Add SSH key to authorized_keys list (for SSH access).

```bash
perry ssh authorize ~/.ssh/id_ed25519.pub
perry ssh authorize ~/.ssh/id_ed25519.pub -w myproject
```

| Option | Description |
|--------|-------------|
| `-w, --workspace <name>` | Apply to specific workspace only |

### `perry ssh remove <key-path>`

Remove SSH key from configuration.

```bash
perry ssh remove ~/.ssh/id_ed25519
perry ssh remove ~/.ssh/id_ed25519 --copy       # Remove from copy list only
perry ssh remove ~/.ssh/id_ed25519 --authorize  # Remove from authorize list only
perry ssh remove ~/.ssh/id_ed25519 -w myproject # Specific workspace
```

| Option | Description |
|--------|-------------|
| `-w, --workspace <name>` | Apply to specific workspace only |
| `--copy` | Remove from copy list only |
| `--authorize` | Remove from authorize list only |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PERRY_CONFIG_DIR` | Override default config directory |
| `PERRY_PORT` | Override default agent port (7391) |
| `PERRY_NO_HOST_ACCESS` | Disable host access when set to `true` |
| `WS_CONFIG_DIR` | Alternative config directory override |
