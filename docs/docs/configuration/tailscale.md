---
sidebar_position: 6
---

# Tailscale Integration

Perry integrates with [Tailscale](https://tailscale.com) to provide secure remote access to your workspaces.

## Overview

When Tailscale is running on your machine, Perry automatically:
- Detects your Tailscale hostname
- Enables HTTPS via Tailscale Serve (if configured)
- Allows access from any device on your tailnet

## Setup

### 1. Install Tailscale

Follow the [Tailscale installation guide](https://tailscale.com/download) for your platform.

### 2. Enable HTTPS (Optional but Recommended)

Check that HTTPS certificates are enabled in your [Tailscale admin console](https://login.tailscale.com/admin/dns).

### 3. Set Operator Permissions

Allow Perry to use Tailscale Serve without sudo:

```bash
sudo tailscale set --operator=$USER
```

This only needs to be done once per machine.

### 4. Start Perry

```bash
perry agent run
```

If Tailscale is configured, you'll see:

```
[agent] Tailscale detected: your-machine.tail-scale.ts.net
[agent] Tailscale Serve enabled
[agent] Agent running at http://localhost:7391
[agent] Tailscale HTTPS: https://your-machine.tail-scale.ts.net
```

## Remote Access

### From Another Machine

On a different device on your tailnet:

```bash
# Configure CLI to use remote agent
perry config worker your-machine.tail-scale.ts.net

# Use normally
perry list
perry start myproject
perry shell myproject
```

### From Browser

Access the Web UI at:
- `https://your-machine.tail-scale.ts.net` (with HTTPS)
- `http://your-machine.tail-scale.ts.net:7391` (without HTTPS)

### From Mobile

Access the Web UI from your phone's browser while connected to your tailnet.

## How Tailscale Serve Works

[Tailscale Serve](https://tailscale.com/kb/1312/serve) exposes your local Perry agent over HTTPS using valid Let's Encrypt certificates. This means:

- No browser security warnings
- Encrypted traffic on your tailnet
- User identity available via headers

Perry runs `tailscale serve --bg 7391` automatically when the agent starts.

## Behavior Matrix

| Scenario | Behavior |
|----------|----------|
| Tailscale not installed | Agent runs on localhost only |
| Tailscale running, HTTPS enabled, operator set | HTTPS via Tailscale Serve |
| Tailscale running, HTTPS enabled, no operator | Logs instructions, localhost only |
| Tailscale running, HTTPS not enabled | Agent accessible via Tailscale IP |

## Troubleshooting

### "Tailscale Serve requires operator permissions"

You'll see this message:

```
[agent] Tailscale Serve requires operator permissions
[agent] To enable: Run: sudo tailscale set --operator=$USER
[agent] Continuing without HTTPS...
```

**Fix:** Run `sudo tailscale set --operator=$USER` and restart the agent.

### "Tailscale HTTPS not enabled in tailnet"

Enable HTTPS certificates in your [Tailscale DNS settings](https://login.tailscale.com/admin/dns).

### Tailscale Not Detected

Verify Tailscale is running:

```bash
tailscale status
```

### Check Agent Info

```bash
perry info
```

Shows Tailscale status including DNS name and HTTPS URL if available.

## Security

When using Tailscale:
- All traffic is encrypted within your tailnet
- Only devices on your tailnet can access Perry
- No ports need to be opened on your firewall
- User identity is available for future authentication features

Without Tailscale, Perry binds to localhost by default. For remote access without Tailscale, use a reverse proxy with proper authentication.

## Stopping Tailscale Serve

Tailscale Serve is stopped automatically when the Perry agent exits. To manually stop:

```bash
tailscale serve off
```
