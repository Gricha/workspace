# Troubleshooting

Common issues and their solutions.

## Docker Issues

### "Cannot connect to Docker daemon"

**Cause:** Docker is not running or not accessible.

**Solutions:**
1. Start Docker Desktop or Docker Engine
2. Ensure your user is in the `docker` group:
   ```bash
   sudo usermod -aG docker $USER
   # Log out and back in
   ```
3. Check Docker is running:
   ```bash
   docker info
   ```

### "Image 'workspace:latest' not found"

**Cause:** The workspace image hasn't been built.

**Solution:**
```bash
ws build
```

### Build fails with "no space left on device"

**Cause:** Docker has run out of disk space.

**Solution:**
```bash
docker system prune -a
```

## Workspace Issues

### Workspace stuck in "creating" status

**Cause:** Container creation failed or timed out.

**Solutions:**
1. Check container logs:
   ```bash
   docker logs workspace-<name>
   ```
2. Delete and recreate:
   ```bash
   ws delete <name>
   ws create <name>
   ```

### Cannot SSH into workspace

**Cause:** SSH port not accessible or container not running.

**Solutions:**
1. Verify workspace is running (status: green)
2. Check SSH port in workspace details
3. Try connecting:
   ```bash
   ssh -v -p <port> workspace@localhost
   ```
4. Restart the workspace

### Git clone fails during workspace creation

**Cause:** SSH key not available or repository access denied.

**Solutions:**
1. Ensure SSH key is configured in Settings > Files
2. Check key has access to the repository
3. Verify key is added to ssh-agent on host:
   ```bash
   ssh-add -l
   ```

## Agent Issues

### Agent won't start

**Cause:** Port already in use or permissions issue.

**Solutions:**
1. Check if port 8420 is in use:
   ```bash
   lsof -i :8420
   ```
2. Use a different port:
   ```bash
   ws agent start --port 3000
   ```

### Web UI not loading

**Cause:** Agent not running or firewall blocking.

**Solutions:**
1. Verify agent is running:
   ```bash
   ws agent status
   ```
2. Check browser console for errors
3. Try a different browser

### API errors in web UI

**Cause:** Agent crashed or configuration invalid.

**Solutions:**
1. Check agent logs:
   ```bash
   docker logs workspace-agent
   ```
2. Restart the agent:
   ```bash
   ws agent stop && ws agent start
   ```

## AI Agent Issues

### Claude Code: "Token invalid" or onboarding prompts

**Cause:** OAuth token not configured correctly.

**Solutions:**
1. Regenerate token: `claude setup-token`
2. Ensure full token is pasted (no truncation)
3. Restart the workspace after updating token

### OpenCode: "API key not found"

**Cause:** Environment variable not injected.

**Solutions:**
1. Verify key is saved in Settings > Agents
2. Stop and start the workspace
3. Check environment in workspace:
   ```bash
   echo $OPENAI_API_KEY
   ```

### Sessions not showing

**Cause:** No sessions exist or parser error.

**Solutions:**
1. Ensure workspace is running
2. Start an AI agent session in the workspace
3. Check workspace has sessions directory:
   ```bash
   ls ~/.claude  # for Claude Code
   ```

## Terminal Issues

### Web terminal not connecting

**Cause:** WebSocket connection failed.

**Solutions:**
1. Check browser supports WebSocket
2. Verify workspace is running
3. Refresh the page
4. Check for proxy/firewall blocking WebSocket

### Terminal shows garbled output

**Cause:** Terminal size mismatch or encoding issue.

**Solutions:**
1. Resize browser window
2. Close and reopen terminal
3. Run `reset` command in terminal

## Performance Issues

### Slow workspace startup

**Cause:** Large files being copied or slow network.

**Solutions:**
1. Reduce credential files size
2. Simplify post-start scripts
3. Check Docker disk performance

### Sessions page loads slowly

**Cause:** Many sessions with large message histories.

**Solutions:**
1. Page loads 50 sessions at a time
2. Filter by agent type
3. Delete old session data from workspaces

## Getting Help

If issues persist:

1. Check Docker and container logs
2. File an issue at https://github.com/subroutinecom/workspace/issues
3. Include:
   - OS and version
   - Docker version (`docker --version`)
   - Error messages
   - Steps to reproduce
