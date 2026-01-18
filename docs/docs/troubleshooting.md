---
sidebar_position: 100
---

# Troubleshooting

Common issues and solutions.

## Docker Issues

### "Cannot connect to Docker daemon"

Docker is not running.

**macOS/Windows:**
Start Docker Desktop.

**Linux:**
```bash
sudo systemctl start docker
sudo usermod -aG docker $USER
# Log out and back in
```

### "Image not found"

The workspace image hasn't been pulled or built.

```bash
# Build locally
perry build

# Or let Perry pull from registry (automatic on first workspace creation)
```

### "No space left on device"

Docker has run out of disk space.

```bash
docker system prune -a
docker volume prune
```

## Workspace Issues

### Workspace stuck in "creating"

Container creation failed.

```bash
# Check logs
perry logs <name>
docker logs workspace-<name>

# Delete and recreate
perry delete <name>
perry start <name>
```

### Cannot SSH into workspace

```bash
# Verify workspace is running
perry list

# Get SSH port
perry info <name>

# Test connection
ssh -v -p <port> workspace@localhost
```

Default username is `workspace`, no password (uses keys or docker exec).

### Git clone fails

SSH key not available or wrong URL.

```bash
# Check SSH key configuration
perry ssh show

# Test GitHub access inside workspace
perry shell <name>
ssh -T git@github.com
```

Or use HTTPS:
```bash
perry start myproject --clone https://github.com/user/repo.git
```

## Agent Issues

### Agent won't start

Port already in use.

```bash
# Check port
lsof -i :7391

# Use different port
perry agent run --port 3000
```

### Web UI not loading

```bash
# Check agent status
perry agent status

# Test API
curl http://localhost:7391/health
```

### "No agent configured"

If you run a Perry command without an agent configured (and no local agent is running), Perry will prompt you interactively for the agent hostname.

You can also configure it manually:

```bash
# For remote agent
perry config agent myserver.ts.net

# With explicit port
perry config agent myserver.ts.net:7391
```

For local usage, simply start the agent with `perry agent run` and Perry will automatically connect to it.

## AI Agent Issues

### Claude Code: Not authenticated

Verify the host credentials are available and re-sync:

- Ensure `~/.claude/.credentials.json` exists on the host.
- Restart the workspace to re-sync.

### OpenCode: API key not found

Confirm the host config is present and re-sync:

- Ensure `~/.config/opencode/opencode.json` exists on the host.
- Ensure `~/.local/share/opencode/auth.json` exists on the host.
- Restart the workspace to re-sync.

Or set environment variable:
```json
{
  "credentials": {
    "env": {
      "OPENAI_API_KEY": "sk-..."
    }
  }
}
```

### Sessions not showing

1. Verify the workspace is running
2. Start an agent inside the workspace (`claude`, `opencode`, or `codex`)
3. Refresh the Web UI; Sessions are a history/shortcut list and open terminals

## Terminal Issues

### Web terminal not connecting

- Check workspace is running
- Try different browser or incognito mode
- Disable ad blockers

### Terminal garbled output

```bash
reset
clear
```

## Tailscale Issues

### "Tailscale Serve requires operator permissions"

```bash
sudo tailscale set --operator=$USER
```

### Tailscale not detected

```bash
tailscale status
```

## Getting Help

### Collect diagnostic info

```bash
perry --version
perry info
docker version
docker info
```

### View logs

```bash
perry logs <workspace-name>
perry agent logs
docker logs workspace-<name>
```

### File an issue

https://github.com/gricha/perry/issues

Include:
- OS and version
- Docker version
- Perry version
- Full error message
- Steps to reproduce
