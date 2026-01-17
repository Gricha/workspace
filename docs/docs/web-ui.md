---
sidebar_position: 6
---

# Web UI

The Web UI is served directly by the agent and provides workspace management and terminal access.

## Access

**Locally:**
```
http://localhost:7391
```

**Remotely via Tailscale:**
```
http://<hostname>:7391
```

With [Tailscale Serve](https://tailscale.com/kb/1312/serve) configured, Perry automatically advertises itself over HTTPS at your Tailscale hostname.

## What you can do

- Create, start, stop, clone, and delete workspaces
- Open a terminal into any running workspace
- View Sessions (history/shortcuts) that open terminals
- Configure ports for `perry proxy`
- Edit settings for credentials, files, scripts, agents, and networking

## Sessions behavior

The Sessions tab is a history/shortcut list. Opening a session drops you into a terminal in that workspace.

## Host access

By default, the agent can also open terminals on the host machine. Disable it if you only want container access:

```bash
perry agent run --no-host-access
```
