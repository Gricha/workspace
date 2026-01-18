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

### `perry agent config`

Launch the interactive configuration wizard. Use this on the machine running the agent to configure agent settings, SSH keys, GitHub token, and Tailscale.

```bash
perry agent config
```

### `perry agent show-config`

Show current agent configuration.

```bash
perry agent show-config
```

### `perry agent kill`

Stop the running agent daemon.

```bash
perry agent kill
```

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

If the workspace is connected to Tailscale, Perry uses SSH to connect. Otherwise, it uses direct Docker exec for local agents and WebSocket for remote agents.

### `perry clone <source> <clone-name>`

Clone an existing workspace with all its data.

```bash
perry clone myproject myproject-copy
```

This creates a new workspace by:
- Copying the home volume (all files in `/home/workspace`)
- Copying the Docker-in-Docker volume
- Creating a new container with copied volumes
- Assigning a new SSH port

The source workspace is temporarily stopped during cloning to ensure data consistency.

### `perry sync <name>`

Re-sync credentials and files to a running workspace.

```bash
perry sync myproject
```

Use after updating configuration to apply changes without restarting.

Sync all running workspaces:

```bash
perry sync --all
```

### `perry ports <name> [ports...]`

Configure ports to forward for a workspace. Once configured, `perry proxy` will use these ports automatically.

```bash
perry ports myproject                # Show configured ports
perry ports myproject 3000 5173      # Configure ports 3000 and 5173
perry ports myproject 3000 5173 8080 # Update to new set of ports
```

Ports are stored per-workspace and persist across restarts. You can also configure ports via the Web UI in the workspace settings tab.

### `perry proxy <name> [ports...]`

Forward ports from workspace to local machine.

```bash
perry proxy myproject                # Use configured ports (from `perry ports`)
perry proxy myproject 3000           # Forward port 3000 (overrides config)
perry proxy myproject 8080:3000      # Local 8080 -> remote 3000
perry proxy myproject 3000 5173      # Multiple ports
```

If no ports are specified and none are configured, shows usage help.

Notes:
- For local agents, `perry proxy` connects directly to the container IP.
- For remote agents, `perry proxy` uses SSH tunneling through the workspace SSH port.

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

## Update Commands

### `perry update`

Update Perry to the latest version.

```bash
perry update
perry update --force
```

If the agent is running, it will be restarted. Run `perry sync --all` after updating to refresh running workspaces.

## Configuration Commands

### `perry config`

Show current client configuration.

```bash
perry config
perry config show    # Same as above
```

### `perry config agent [hostname]`

Get or set the agent hostname for remote connections.

```bash
perry config agent                     # Show current agent
perry config agent myserver            # Set agent (uses default port 7391)
perry config agent myserver:7391       # Set agent with explicit port
perry config agent myserver.ts.net     # Tailscale hostname
```

When you set an agent, Perry verifies the connection before saving.

If you run any Perry command without configuring an agent (and no local agent is running), Perry will interactively prompt you for the agent hostname.

See also: `perry agent config` and `perry agent show-config` in [Agent Commands](#agent-commands).

## SSH Commands

SSH key management allows you to control which keys can access workspaces and which keys are copied into workspaces for git operations.

### Auto-Authorization

When auto-authorize is enabled (default), Perry automatically authorizes:

1. **Host SSH keypairs** - All public keys found in `~/.ssh/` (e.g., `id_ed25519.pub`, `id_rsa.pub`)
2. **Host authorized_keys** - All keys from the host's `~/.ssh/authorized_keys` file

This means any machine that can SSH to the host can also SSH directly to workspaces. This is useful when:
- You SSH from your workstation to a dev server running Perry
- You want your workstation's key to work for both the host AND its workspaces
- You have multiple machines authorized to access the host

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

When enabled, auto-authorize includes both:
- Public keys from `~/.ssh/*.pub` (host's own keypairs)
- Keys from `~/.ssh/authorized_keys` (keys authorized to access the host)

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
| `PERRY_TAILSCALE_AUTH_KEY` | Override Tailscale auth key for workspace networking |
| `WS_CONFIG_DIR` | Alternative config directory override |
