# Configuration

Configure environment variables, files, and scripts for your workspaces.

## Environment Variables

Set environment variables that will be available in all workspaces.

### Via Web UI

1. Go to Settings > Environment
2. Add key-value pairs
3. Save

### Via Configuration File

Edit `~/.workspace-agent/config.yaml`:

```yaml
credentials:
  env:
    MY_SECRET: "value"
    DATABASE_URL: "postgres://..."
```

Environment variables are injected when workspaces start.

## Credential Files

Copy sensitive files (SSH keys, configs) into workspaces.

### Via Web UI

1. Go to Settings > Files
2. Add mappings: destination path → source path on host
3. Save

### Via Configuration File

```yaml
credentials:
  files:
    ~/.ssh/id_ed25519: ~/.ssh/id_ed25519
    ~/.gitconfig: ~/.gitconfig
    ~/.npmrc: ~/.npmrc
```

Files are copied on workspace start with appropriate permissions:
- SSH private keys get mode `600`
- Other files get mode `644`

## Post-Start Scripts

Run custom scripts after workspace containers start.

### Via Configuration File

```yaml
scripts:
  post_start: ~/.workspace-agent/scripts/post-start.sh
```

Example post-start script:

```bash
#!/bin/bash
# Install project-specific tools
npm install -g pnpm
pip install poetry

# Set up git
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## Agent Configuration

See [Coding Agents](./agents.md) for configuring AI assistants.

## Configuration Precedence

1. Agent-level config (`~/.workspace-agent/config.yaml`)
2. Per-workspace environment variables (at creation time)
3. Container environment

## Reloading Configuration

Configuration changes apply to newly started workspaces. To apply changes to an existing workspace:

1. Stop the workspace
2. Start it again

Environment and file injection happens during container startup.

## Security Considerations

- API keys and tokens are stored in plaintext in the config file
- Secure your `~/.workspace-agent/` directory
- Don't commit config files to version control
- Use environment-specific keys for production vs development

## File Locations

| Item | Path |
|------|------|
| Agent config | `~/.workspace-agent/config.yaml` |
| State database | `~/.workspace-agent/state.json` |
| Workspace volumes | Docker volumes `workspace-<name>` |
