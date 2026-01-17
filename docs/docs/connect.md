---
sidebar_position: 2
---

# Connect

Perry lets you connect to workspaces from any device using the CLI, Web UI, or SSH.

## CLI (fastest)

```bash
perry shell myproject
```

If your CLI is on a different machine, point it at the agent first:

```bash
perry config agent <hostname>
```

## Web UI

Open the workspace and start a terminal session from the terminal tab.

```
http://<agent-host>:7391
```

## SSH

If Tailscale is enabled for workspaces:

```bash
ssh workspace@<workspace-name>
```

If Tailscale is not enabled, use `perry shell` or configure `perry proxy` for port forwarding.

## Host access

By default, the agent can also open terminals on the host machine. Disable this at startup:

```bash
perry agent run --no-host-access
```
