---
sidebar_position: 1
---

# Configuration Overview

Configure the Workspace agent to inject credentials, files, and scripts into all workspaces.

## Configuration File

Agent configuration is stored in:

```
~/.workspace-agent/config.yaml
```

This YAML file contains:
- **credentials.env**: Environment variables
- **credentials.files**: File mappings
- **scripts**: Post-start scripts

## Default Configuration

On first run, the agent creates a minimal config:

```yaml
credentials:
  env: {}
  files: {}
scripts: {}
```

## Configuration Structure

```yaml
credentials:
  # Environment variables injected into all workspaces
  env:
    ANTHROPIC_API_KEY: "sk-ant-..."
    OPENAI_API_KEY: "sk-..."
    GITHUB_TOKEN: "ghp_..."
    DATABASE_URL: "postgres://..."

  # Files copied into all workspaces
  # Format: destination:source
  files:
    ~/.ssh/id_ed25519: ~/.ssh/id_ed25519
    ~/.ssh/id_ed25519.pub: ~/.ssh/id_ed25519.pub
    ~/.gitconfig: ~/.gitconfig
    ~/.npmrc: ~/.npmrc

# Scripts run after workspace starts
scripts:
  post_start: ~/.workspace-agent/scripts/post-start.sh
```

## Editing Configuration

### Via Web UI

1. Open `http://localhost:8420`
2. Go to Settings
3. Use the tabs:
   - **Environment**: Add/edit environment variables
   - **Files**: Add file mappings
   - **Agents**: Configure AI assistant credentials
4. Click Save

Changes are written to `config.yaml` immediately.

### Via Text Editor

Edit `~/.workspace-agent/config.yaml` directly:

```bash
nano ~/.workspace-agent/config.yaml
# or
vim ~/.workspace-agent/config.yaml
# or
code ~/.workspace-agent/config.yaml
```

:::tip
YAML is whitespace-sensitive. Use 2 spaces for indentation, not tabs.
:::

## Applying Configuration

Configuration changes apply to:
- ✅ **New workspaces**: Immediately
- ❌ **Running workspaces**: No effect
- ✅ **Stopped workspaces**: When restarted

To apply changes to existing workspaces:

```bash
ws stop <name>
ws start <name>
```

Or restart via Web UI.

## Configuration Categories

### Environment Variables

Common uses:
- API keys for AI services
- Database connection strings
- Service credentials
- Feature flags

See [Environment Variables](./environment-variables.md) for details.

### Credential Files

Common files to inject:
- SSH private keys
- Git configuration (`.gitconfig`)
- NPM registry auth (`.npmrc`)
- Cloud provider credentials

See [Credential Files](./credential-files.md) for details.

### User Scripts

Run custom setup after workspace starts:
- Install additional tools
- Configure shell (zsh, bash)
- Set up git aliases
- Initialize databases

See [User Scripts](./user-scripts.md) for details.

## Security Considerations

### File Permissions

```bash
# Config file should be readable only by you
chmod 600 ~/.workspace-agent/config.yaml

# Directory should be protected
chmod 700 ~/.workspace-agent
```

### Credential Storage

Credentials are stored in **plaintext** in `config.yaml`:

- ✅ **Do**: Secure the file with filesystem permissions
- ✅ **Do**: Use environment-specific credentials (dev vs prod)
- ❌ **Don't**: Commit `config.yaml` to version control
- ❌ **Don't**: Share your config file
- ❌ **Don't**: Use production credentials in workspaces

### Best Practices

1. **Rotate credentials regularly**
   - Regenerate API keys periodically
   - Update tokens when compromised

2. **Use least privilege**
   - Grant minimal permissions needed
   - Use separate keys per service

3. **Monitor usage**
   - Check AI service usage dashboards
   - Set up billing alerts

4. **Backup configuration**
   ```bash
   cp ~/.workspace-agent/config.yaml ~/backup/config.yaml.backup
   ```

## Validation

The agent validates configuration on startup:

- YAML syntax errors → Agent fails to start
- Missing files referenced → Warning logged
- Invalid paths → Warning logged

Check validation:

```bash
ws agent start
# Watch for warnings
```

## Configuration Precedence

When a workspace starts, credentials are merged:

1. **Agent config** (`config.yaml`)
2. **Environment-specific overrides** (future feature)
3. **Workspace creation parameters** (env vars passed to `ws create`)

Later sources override earlier ones for the same key.

## Example Configurations

### Minimal Setup

```yaml
credentials:
  env:
    ANTHROPIC_API_KEY: "sk-ant-..."
  files:
    ~/.ssh/id_ed25519: ~/.ssh/id_ed25519
    ~/.gitconfig: ~/.gitconfig
```

### Full-Stack Developer

```yaml
credentials:
  env:
    # AI Assistants
    CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat01-..."
    OPENAI_API_KEY: "sk-..."
    GITHUB_TOKEN: "ghp_..."

    # Databases
    DATABASE_URL: "postgres://localhost/dev"
    REDIS_URL: "redis://localhost"

    # Cloud Providers
    AWS_ACCESS_KEY_ID: "AKIA..."
    AWS_SECRET_ACCESS_KEY: "..."

  files:
    ~/.ssh/id_ed25519: ~/.ssh/id_ed25519
    ~/.ssh/id_ed25519.pub: ~/.ssh/id_ed25519.pub
    ~/.gitconfig: ~/.gitconfig
    ~/.npmrc: ~/.npmrc
    ~/.aws/credentials: ~/.aws/credentials

scripts:
  post_start: ~/.workspace-agent/scripts/post-start.sh
```

### Team Configuration

For team-wide consistency, share a template:

```yaml
# Team template - customize with your credentials
credentials:
  env:
    # TODO: Add your Anthropic API key
    ANTHROPIC_API_KEY: "YOUR_KEY_HERE"

    # TODO: Add your GitHub token
    GITHUB_TOKEN: "YOUR_TOKEN_HERE"

    # Shared config
    NODE_ENV: "development"
    LOG_LEVEL: "debug"

  files:
    ~/.gitconfig: ~/.gitconfig
    ~/.ssh/id_ed25519: ~/.ssh/id_ed25519

scripts:
  post_start: ./team-setup.sh
```

## Troubleshooting

### Configuration not taking effect

**Problem**: Added env var but it's not in workspace.

**Solutions**:
1. Restart the workspace
2. Check `config.yaml` saved correctly
3. Verify YAML syntax (no tabs, correct indentation)

### File copy fails

**Problem**: Configured file not found in workspace.

**Solutions**:
1. Check source path exists on host
2. Use absolute paths, not relative
3. Check file permissions on host

### YAML parsing errors

**Problem**: Agent fails to start with syntax error.

**Solutions**:
1. Use online YAML validator
2. Check indentation (2 spaces, no tabs)
3. Quote strings with special characters:
   ```yaml
   MY_VAR: "value:with:colons"
   ```

## Next Steps

- [Configure Environment Variables](./environment-variables.md)
- [Set Up Credential Files](./credential-files.md)
- [Create User Scripts](./user-scripts.md)
- [Configure AI Agents](../agents/overview.md)
