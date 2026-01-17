---
sidebar_position: 4
---

# Networking

Perry is designed for remote access over Tailscale. When enabled, each workspace gets a tailnet hostname and all ports are reachable directly.

## Tailscale-first

1) Add a Tailscale auth key in the Web UI (Settings > Configuration > Networking)
2) Restart a workspace

Then access services directly:

```bash
curl http://myproject:3000
ssh workspace@myproject
```

See [Tailscale Integration](./configuration/tailscale.md) for full setup and security notes.

## SSH access over Tailscale

When workspaces join your tailnet, you can SSH directly using the `workspace` user. SSH keys are managed on the host and synced into containers:

- **Authorized keys** control which keys can SSH into workspaces.
- **Copied keys** are placed in the workspace for git operations.

By default, Perry auto-authorizes host keys it finds in `~/.ssh/` and `~/.ssh/authorized_keys`. You can add or scope keys with:

```bash
perry ssh list
perry ssh authorize ~/.ssh/id_ed25519.pub
perry ssh copy ~/.ssh/id_ed25519 -w myproject
```

## Port forwarding (fallback)

If you are not using Tailscale, forward ports from the workspace to your local machine.

Configure persistent ports:

```bash
perry ports myproject 3000 5173
perry proxy myproject
```

One-time forward:

```bash
perry proxy myproject 8080:3000
```

Notes:
- For local agents, `perry proxy` connects directly to the container IP.
- For remote agents, `perry proxy` uses SSH tunneling through the workspace SSH port.
