---
sidebar_position: 100
---

# Troubleshooting

Common issues and their solutions when working with Perry.

## Docker Issues

### "Cannot connect to Docker daemon"

**Symptoms:** Error when running `perry build` or Docker commands.

**Cause:** Docker is not running or not accessible.

**Solutions:**

1. **Start Docker:**
   ```bash
   # macOS/Windows: Start Docker Desktop
   # Linux: Start Docker service
   sudo systemctl start docker
   ```

2. **Add user to docker group (Linux):**
   ```bash
   sudo usermod -aG docker $USER
   # Log out and back in for changes to take effect
   newgrp docker
   ```

3. **Verify Docker is running:**
   ```bash
   docker info
   docker ps
   ```

### "Image 'workspace:latest' not found"

**Symptoms:** Workspace creation fails with missing image error.

**Cause:** The base workspace image hasn't been built.

**Solution:**

```bash
perry build
# Wait for build to complete (5-10 minutes)
```

### Build fails with "no space left on device"

**Symptoms:** Docker build fails partway through.

**Cause:** Docker has run out of disk space.

**Solutions:**

1. **Clean up Docker resources:**
   ```bash
   docker system prune -a
   # Confirm when prompted
   ```

2. **Check disk space:**
   ```bash
   docker system df
   df -h
   ```

3. **Remove unused images:**
   ```bash
   docker image prune -a
   ```

## Workspace Issues

### Workspace stuck in "creating" status

**Symptoms:** Workspace shows orange "creating" status indefinitely.

**Cause:** Container creation failed or timed out.

**Solutions:**

1. **Check container logs:**
   ```bash
   docker logs workspace-<name>
   perry logs <name>
   ```

2. **Check running containers:**
   ```bash
   docker ps -a | grep workspace-<name>
   ```

3. **Delete and recreate:**
   ```bash
   perry delete <name>
   perry start <name>
   ```

4. **Check for port conflicts:**
   ```bash
   # See if SSH port range (2200-2400) is available
   netstat -tuln | grep 22
   ```

### Cannot SSH into workspace

**Symptoms:** SSH connection refused or timeout.

**Cause:** Workspace not running, SSH daemon not started, or port incorrect.

**Solutions:**

1. **Verify workspace is running:**
   ```bash
   perry list
   # Status should be "running" (green)
   ```

2. **Get correct SSH port:**
   ```bash
   perry list
   # Check the ssh:// URL for the port
   ```

3. **Test connection with verbose output:**
   ```bash
   ssh -v -p <port> workspace@localhost
   ```

4. **Restart the workspace:**
   ```bash
   perry stop <name>
   perry start <name>
   ```

5. **Check SSH daemon inside workspace:**
   ```bash
   docker exec workspace-<name> systemctl status ssh
   ```

### Git clone fails during workspace creation

**Symptoms:** Workspace created but repository not cloned.

**Cause:** SSH key not available, wrong repository URL, or access denied.

**Solutions:**

1. **Verify SSH key configured:**
   - Go to Settings > Files in Web UI
   - Ensure `~/.ssh/id_ed25519` (or your key) is mapped

2. **Test SSH key access:**
   ```bash
   ssh -T git@github.com
   # Should show: "Hi username! You've successfully authenticated"
   ```

3. **Check key is in ssh-agent:**
   ```bash
   ssh-add -l
   ```

4. **Use HTTPS URL instead:**
   ```bash
   perry start myproject --clone https://github.com/user/repo.git
   ```

### Workspace deleted but container still running

**Symptoms:** `docker ps` shows workspace container after deletion.

**Cause:** Container deletion failed during cleanup.

**Solution:**

```bash
# Manually remove container
docker stop workspace-<name>
docker rm workspace-<name>

# Remove volume
docker volume rm workspace-<name>
```

## Agent Issues

### Agent won't start

**Symptoms:** `perry agent run` fails or exits immediately.

**Cause:** Port already in use, permissions issue, or invalid configuration.

**Solutions:**

1. **Check if port is in use:**
   ```bash
   lsof -i :7391
   # or
   netstat -tuln | grep 7391
   ```

2. **Use a different port:**
   ```bash
   perry agent run --port 3000
   ```

3. **Check configuration file:**
   ```bash
   cat ~/.config/perry/config.json
   # Fix any YAML syntax errors
   ```

4. **Check agent logs:**
   ```bash
   # If running in background
   docker logs workspace-agent
   ```

5. **Remove state file if corrupted:**
   ```bash
   mv ~/.workspace-agent/state.json ~/.workspace-agent/state.json.backup
   perry agent run
   ```

### Web UI not loading

**Symptoms:** Browser shows "Cannot connect" or blank page.

**Cause:** Agent not running, firewall blocking, or wrong URL.

**Solutions:**

1. **Verify agent is running:**
   ```bash
   perry agent status
   # Should show "Agent is running on port 7391"
   ```

2. **Test API directly:**
   ```bash
   curl http://localhost:7391/rpc
   # Should return JSON response
   ```

3. **Check firewall (Linux):**
   ```bash
   sudo ufw status
   sudo ufw allow 7391
   ```

4. **Try different browser:**
   - Clear cache
   - Try incognito/private mode
   - Check browser console for errors (F12)

### API errors in web UI

**Symptoms:** "Failed to fetch" or 500 errors in browser.

**Cause:** Agent crashed, configuration invalid, or Docker issue.

**Solutions:**

1. **Check browser console (F12):**
   - Look for specific error messages
   - Check Network tab for failed requests

2. **Restart the agent:**
   ```bash
   # Stop the agent process and restart
   perry agent run
   ```

3. **Check Docker daemon:**
   ```bash
   docker info
   systemctl status docker
   ```

## AI Agent Issues

### Claude Code: "Token invalid" or onboarding prompts

**Symptoms:** Claude Code asks for onboarding inside workspace.

**Cause:** OAuth token not configured or invalid.

**Solutions:**

1. **Generate new token:**
   ```bash
   # On your host machine (not in workspace)
   claude setup-token
   ```

2. **Add token to agent:**
   - Go to Settings > Agents in Web UI
   - Paste token into "Claude Code OAuth Token" field
   - Save configuration

3. **Ensure full token is copied:**
   - Tokens are long (100+ characters)
   - Copy entire token without truncation

4. **Restart workspace for changes:**
   ```bash
   perry stop <name>
   perry start <name>
   ```

5. **Verify token inside workspace:**
   ```bash
   ssh -p <port> workspace@localhost
   echo $CLAUDE_CODE_OAUTH_TOKEN
   # Should show your token
   ```

### OpenCode: "API key not found"

**Symptoms:** OpenCode command fails with missing key error.

**Cause:** `OPENAI_API_KEY` environment variable not set.

**Solutions:**

1. **Verify key in agent config:**
   - Settings > Agents > OpenCode section
   - Ensure API key is entered and saved

2. **Stop and start workspace:**
   ```bash
   perry stop <name>
   perry start <name>
   ```

3. **Check environment variable:**
   ```bash
   ssh -p <port> workspace@localhost
   echo $OPENAI_API_KEY
   # Should show your key (sk-...)
   ```

4. **Manually set for testing:**
   ```bash
   export OPENAI_API_KEY=sk-...
   opencode
   ```

### GitHub Copilot: Authentication failed

**Symptoms:** `gh copilot` commands fail with auth error.

**Cause:** GitHub token not configured or lacks permissions.

**Solutions:**

1. **Create token with correct scopes:**
   - Go to https://github.com/settings/personal-access-tokens/new
   - Select "Copilot Requests" permission
   - Copy token

2. **Add to agent config:**
   - Settings > Agents > GitHub Token
   - Save

3. **Restart workspace:**
   ```bash
   perry stop <name>
   perry start <name>
   ```

4. **Authenticate inside workspace:**
   ```bash
   ssh -p <port> workspace@localhost
   gh auth login
   # Follow prompts
   ```

### Sessions not showing in UI

**Symptoms:** Sessions page is empty despite using AI agents.

**Cause:** No sessions exist, workspace not running, or parser error.

**Solutions:**

1. **Verify workspace is running:**
   - Select workspace from dropdown
   - Check status is "running"

2. **Create a session:**
   ```bash
   ssh -p <port> workspace@localhost
   claude
   # Have a conversation, then exit
   ```

3. **Check session directories exist:**
   ```bash
   ssh -p <port> workspace@localhost
   ls -la ~/.claude    # Claude Code
   ls -la ~/.opencode  # OpenCode
   ```

4. **Refresh the page:**
   - Sessions may take a moment to appear

## Terminal Issues

### Web terminal not connecting

**Symptoms:** Terminal shows "Connecting..." indefinitely.

**Cause:** WebSocket connection failed or workspace not running.

**Solutions:**

1. **Check workspace status:**
   - Ensure workspace is running (green status)

2. **Check browser WebSocket support:**
   - Modern browsers support WebSocket
   - Try different browser

3. **Disable browser extensions:**
   - Ad blockers can interfere with WebSocket
   - Try incognito/private mode

4. **Check for proxy/firewall:**
   - Corporate networks may block WebSocket
   - Try from different network

5. **Use SSH instead:**
   ```bash
   ssh -p <port> workspace@localhost
   ```

### Terminal shows garbled output

**Symptoms:** Random characters or broken formatting.

**Cause:** Terminal size mismatch or encoding issue.

**Solutions:**

1. **Resize browser window:**
   - Terminal should auto-resize

2. **Close and reopen terminal:**
   - Click Terminal button again

3. **Reset terminal:**
   ```bash
   reset
   clear
   ```

4. **Check locale settings:**
   ```bash
   locale
   # Should show UTF-8 encoding
   ```

### Terminal freezes or lags

**Symptoms:** Commands slow to execute or appear.

**Cause:** High CPU usage, network latency, or large output.

**Solutions:**

1. **Check workspace resources:**
   - View workspace details for CPU/memory usage

2. **Limit output:**
   ```bash
   # Instead of: cat large-file.txt
   head -n 100 large-file.txt
   less large-file.txt
   ```

3. **Use SSH for better performance:**
   ```bash
   ssh -p <port> workspace@localhost
   ```

## Performance Issues

### Slow workspace startup

**Symptoms:** Workspace takes minutes to become available.

**Cause:** Large credential files, slow network, or post-start scripts.

**Solutions:**

1. **Reduce credential files:**
   - Only copy necessary files
   - Avoid large SSH private keys

2. **Simplify post-start scripts:**
   - Remove unnecessary commands
   - Make scripts faster

3. **Check Docker performance:**
   ```bash
   docker info
   # Check storage driver (overlay2 is fastest)
   ```

4. **Check network (if cloning repo):**
   - Large repositories take time to clone
   - Consider shallow clone: `--depth 1`

### High disk usage

**Symptoms:** Disk space fills up quickly.

**Cause:** Many Docker images, containers, or volumes.

**Solutions:**

1. **Clean up Docker:**
   ```bash
   docker system prune -a
   docker volume prune
   ```

2. **Check disk usage:**
   ```bash
   docker system df
   du -sh ~/.config/perry
   ```

3. **Delete unused workspaces:**
   ```bash
   perry list
   perry delete <unused-workspace>
   ```

4. **Clean up inside workspaces:**
   ```bash
   ssh -p <port> workspace@localhost
   docker system prune
   ```

### Sessions page loads slowly

**Symptoms:** Long wait when opening Sessions page.

**Cause:** Many sessions with large message histories.

**Solutions:**

1. **Select specific workspace:**
   - Use workspace dropdown to filter
   - Don't select "All Workspaces" if many exist

2. **Filter by agent type:**
   - Use agent filter (Claude Code, OpenCode, etc.)

3. **Delete old sessions:**
   ```bash
   ssh -p <port> workspace@localhost
   rm -rf ~/.claude/sessions/old-*
   ```

## Getting Help

If issues persist after trying these solutions:

1. **Collect diagnostic information:**
   ```bash
   perry info
   docker version
   docker info
   uname -a
   ```

2. **Check logs:**
   ```bash
   perry logs <workspace-name>
   docker logs workspace-<name>
   ```

3. **File an issue:**
   - Visit https://github.com/gricha/perry/issues
   - Search for existing issues first
   - Include:
     - OS and version
     - Docker version
     - Perry version (`perry --version`)
     - Error messages (full output)
     - Steps to reproduce
     - Relevant logs

4. **Community support:**
   - Check GitHub Discussions
   - Review closed issues for solutions

