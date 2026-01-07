---
sidebar_position: 2
---

# Environment Variables

Inject environment variables into all workspaces.

## Configuration

### Via config.json

```json
{
  "credentials": {
    "env": {
      "ANTHROPIC_API_KEY": "sk-ant-...",
      "OPENAI_API_KEY": "sk-...",
      "DATABASE_URL": "postgres://localhost:5432/mydb",
      "NODE_ENV": "development"
    }
  }
}
```

### Via Web UI

1. Open http://localhost:7391
2. Go to Settings > Environment
3. Add key-value pairs
4. Save

## Common Variables

### API Keys

```json
{
  "credentials": {
    "env": {
      "ANTHROPIC_API_KEY": "sk-ant-...",
      "OPENAI_API_KEY": "sk-...",
      "GITHUB_TOKEN": "ghp_..."
    }
  }
}
```

### Database URLs

```json
{
  "credentials": {
    "env": {
      "DATABASE_URL": "postgres://user:pass@host:5432/db",
      "REDIS_URL": "redis://localhost:6379"
    }
  }
}
```

### Development Settings

```json
{
  "credentials": {
    "env": {
      "NODE_ENV": "development",
      "DEBUG": "*",
      "LOG_LEVEL": "debug"
    }
  }
}
```

## Apply Changes

New variables are injected:
- When creating new workspaces
- When starting stopped workspaces
- When running `perry sync <name>` (re-creates container env)

For running workspaces, restart to pick up new environment variables:

```bash
perry stop myproject
perry start myproject
```

## Accessing in Workspace

Variables are available as standard environment variables:

```bash
echo $ANTHROPIC_API_KEY
echo $DATABASE_URL
```

And in your code:

```javascript
process.env.ANTHROPIC_API_KEY
```

```python
import os
os.environ['ANTHROPIC_API_KEY']
```

## Security Notes

- Environment variables are stored in plain text in `config.json`
- They are visible inside containers via `env` command
- For sensitive credentials, consider using secret management tools in production
