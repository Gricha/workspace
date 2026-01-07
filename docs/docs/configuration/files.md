---
sidebar_position: 3
---

# Files

Copy files from your host machine into workspaces.

## Configuration

### Via config.json

```json
{
  "credentials": {
    "files": {
      "~/.gitconfig": "~/.gitconfig",
      "~/.ssh/id_ed25519": "~/.ssh/id_ed25519",
      "~/.ssh/id_ed25519.pub": "~/.ssh/id_ed25519.pub",
      "~/.npmrc": "~/.npmrc"
    }
  }
}
```

Format: `"destination_in_container": "source_on_host"`

### Via Web UI

1. Open http://localhost:7391
2. Go to Settings > Files
3. Add destination/source pairs
4. Save

## Common Files

### Git Configuration

```json
{
  "credentials": {
    "files": {
      "~/.gitconfig": "~/.gitconfig"
    }
  }
}
```

Your git username, email, and aliases will be available in workspaces.

### SSH Keys

```json
{
  "credentials": {
    "files": {
      "~/.ssh/id_ed25519": "~/.ssh/id_ed25519",
      "~/.ssh/id_ed25519.pub": "~/.ssh/id_ed25519.pub",
      "~/.ssh/config": "~/.ssh/config"
    }
  }
}
```

SSH keys are copied with correct permissions (600 for private keys).

### Package Manager Configs

```json
{
  "credentials": {
    "files": {
      "~/.npmrc": "~/.npmrc",
      "~/.yarnrc.yml": "~/.yarnrc.yml",
      "~/.cargo/credentials.toml": "~/.cargo/credentials.toml"
    }
  }
}
```

### AWS Credentials

```json
{
  "credentials": {
    "files": {
      "~/.aws/credentials": "~/.aws/credentials",
      "~/.aws/config": "~/.aws/config"
    }
  }
}
```

## Path Expansion

- `~` expands to home directory on both host and container
- Absolute paths work as-is
- Relative paths are relative to home directory

## File Permissions

Perry sets appropriate permissions:

| File Type | Permissions |
|-----------|-------------|
| SSH private keys | 600 |
| SSH public keys | 644 |
| Other files | 644 |
| Directories | 700 |

## Apply Changes

Files are copied:
- When creating new workspaces
- When starting stopped workspaces
- When running `perry sync <name>`

```bash
# Update a running workspace
perry sync myproject
```

## Directories

You can copy entire directories:

```json
{
  "credentials": {
    "files": {
      "~/.aws": "~/.aws"
    }
  }
}
```

The directory and all contents are copied recursively.

## Excluding Files

To exclude specific files, configure files individually rather than copying entire directories.
