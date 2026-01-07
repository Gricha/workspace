# Tailscale Integration

Perry automatically detects and integrates with [Tailscale](https://tailscale.com) to provide secure HTTPS access to your workspaces over your private network.

## How It Works

When you start the Perry agent, it checks if Tailscale is running on your machine. If Tailscale is detected with HTTPS enabled, Perry automatically starts [Tailscale Serve](https://tailscale.com/kb/1312/serve) to expose the agent over HTTPS using your Tailscale domain.

This gives you:
- **Trusted HTTPS certificates** - No browser warnings, valid certificates from Let's Encrypt
- **Private network access** - Access Perry from any device on your tailnet
- **User identity** - Perry can identify who's making requests via Tailscale headers

## Setup

### 1. Install Tailscale

Follow the [Tailscale installation guide](https://tailscale.com/download) for your platform.

### 2. Enable HTTPS Certificates

Tailscale HTTPS must be enabled for your tailnet. This is typically enabled by default, but you can verify in your [Tailscale admin console](https://login.tailscale.com/admin/dns).

### 3. Set Operator Permissions (Required)

By default, Tailscale Serve requires root permissions. To allow Perry to use it without sudo, run:

```bash
sudo tailscale set --operator=$USER
```

This only needs to be done once per machine.

### 4. Start Perry

```bash
perry agent run
```

If Tailscale is properly configured, you'll see:

```
[agent] Tailscale detected: your-machine.tail-scale.ts.net
[agent] Tailscale Serve enabled
[agent] Agent running at http://localhost:7391
[agent] Tailscale HTTPS: https://your-machine.tail-scale.ts.net
```

## Troubleshooting

### "Tailscale Serve requires operator permissions"

You'll see this message if Tailscale Serve can't start:

```
[agent] Tailscale Serve requires operator permissions
[agent] To enable: Run: sudo tailscale set --operator=$USER
[agent] Continuing without HTTPS...
```

**Fix:** Run `sudo tailscale set --operator=$USER` and restart the agent.

### "Tailscale HTTPS not enabled in tailnet"

Your tailnet doesn't have HTTPS certificates enabled. Check your [Tailscale admin DNS settings](https://login.tailscale.com/admin/dns) and ensure "HTTPS Certificates" is enabled.

### Tailscale Not Detected

If Perry doesn't detect Tailscale at all, verify Tailscale is running:

```bash
tailscale status
```

## Graceful Fallback

Perry always starts successfully regardless of Tailscale status:

| Scenario | Behavior |
|----------|----------|
| Tailscale not installed | Agent starts normally on localhost |
| Tailscale running, HTTPS enabled, operator set | HTTPS via Tailscale Serve |
| Tailscale running, HTTPS enabled, no operator | Logs fix instructions, falls back to localhost |
| Tailscale running, HTTPS not enabled | Falls back to localhost |

## Security Considerations

When using Tailscale Serve:
- Traffic is encrypted end-to-end within your tailnet
- Perry can identify users via `Tailscale-User-*` headers
- Access is limited to devices on your tailnet

Without Tailscale, Perry binds to localhost only by default. For remote access without Tailscale, consider using a reverse proxy with proper authentication.
