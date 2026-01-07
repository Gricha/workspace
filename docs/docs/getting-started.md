---
sidebar_position: 3
---

# Getting Started

## 1. Start the Agent

```bash
perry agent run
```

Run this on the machine you want to access remotely. The Web UI will be available at `http://localhost:7391`.

If the machine is on your Tailscale network, you can access it from any device at `http://<hostname>:7391`. With [Tailscale Serve](https://tailscale.com/kb/1312/serve) configured, Perry will automatically advertise itself over HTTPS.

## 2. Create a Workspace

```bash
perry start myproject
```

Or with a git repository:

```bash
perry start myproject --clone git@github.com:user/repo.git
```

## 3. Connect

**CLI:**
```bash
perry shell myproject
```

**Web UI:**
Open the Web UI, click your workspace, then open a terminal session.

![Web UI Terminal](/img/webui-terminal.png)

You can also view AI coding agent sessions from the Sessions tab:

![Web UI Sessions](/img/webui-sessions.png)

## Connecting from Another Machine

To use the CLI from a different machine (like your laptop):

1. Install Perry on that machine
2. Point it to your agent:

```bash
perry config worker <hostname>:7391
```

Replace `<hostname>` with your machine's Tailscale hostname or IP address. Now all `perry` commands will run against the remote agent.

## That's It

You now have an isolated development environment with:
- Full Linux environment (Ubuntu 24.04)
- Docker support inside the container
- All your configured credentials synced

## Common Commands

```bash
perry list              # List workspaces
perry stop myproject    # Stop workspace
perry start myproject   # Start stopped workspace
perry delete myproject  # Remove workspace
perry logs myproject    # View container logs
perry sync myproject    # Re-sync credentials
```

## Next Steps

- [Configure SSH keys and credentials](./configuration/overview.md)
- [Set up AI coding assistants](./configuration/ai-agents.md)
- [Enable remote access with Tailscale](./configuration/tailscale.md)
