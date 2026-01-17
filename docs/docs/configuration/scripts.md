---
sidebar_position: 4
---

# Scripts

Run custom scripts after workspace starts. Scripts execute after file sync, so they can reference synced resources.

## Configuration

### Via config.json

```json
{
  "scripts": {
    "post_start": [
      "~/.perry/userscripts",
      "~/scripts/setup.sh"
    ],
    "fail_on_error": false
  }
}
```

### Via Web UI

1. Open http://localhost:7391
2. Go to Settings > Scripts
3. Add script paths or directories
4. Toggle "Stop on script error" if needed
5. Save

## Default Configuration

New installations include:

```json
{
  "scripts": {
    "post_start": ["~/.perry/userscripts"],
    "fail_on_error": false
  }
}
```

Create `~/.perry/userscripts/` directory on your host to add startup scripts.

## Script Types

### Single Scripts

Point to a shell script file:

```json
{
  "scripts": {
    "post_start": ["~/scripts/setup.sh"]
  }
}
```

The script must be executable (`chmod +x`).

### Script Directories

Point to a directory containing `.sh` files:

```json
{
  "scripts": {
    "post_start": ["~/.perry/userscripts"]
  }
}
```

All `.sh` files in the directory execute in **sorted order** (alphabetical). Use numeric prefixes to control order:

```
~/.perry/userscripts/
  01-install-tools.sh
  02-configure-git.sh
  10-setup-project.sh
```

Non-`.sh` files are ignored.

## Multiple Sources

Combine scripts and directories:

```json
{
  "scripts": {
    "post_start": [
      "~/.perry/userscripts",
      "~/work/company-setup.sh",
      "~/projects/tools"
    ]
  }
}
```

Scripts execute in array order.

## Error Handling

### Default: Continue on Error

```json
{
  "scripts": {
    "post_start": ["~/scripts/setup.sh"],
    "fail_on_error": false
  }
}
```

If a script fails, Perry logs a warning and continues with remaining scripts. Workspace starts normally.

### Strict Mode

```json
{
  "scripts": {
    "post_start": ["~/scripts/setup.sh"],
    "fail_on_error": true
  }
}
```

If any script exits with non-zero status, workspace startup fails.

## Execution Environment

Scripts run:
- As the `workspace` user
- In the container's home directory (`/home/workspace`)
- After file sync completes (synced files are available)
- With access to configured environment variables

## Common Use Cases

### Install Project Tools

```bash
#!/bin/bash
# ~/.perry/userscripts/01-install-tools.sh

# Install global npm packages
npm install -g typescript tsx

# Install rust tools
cargo install just
```

### Configure Git

```bash
#!/bin/bash
# ~/.perry/userscripts/02-git-config.sh

# Set up git aliases not in .gitconfig
git config --global alias.st status
git config --global alias.co checkout
```

### Create Symlinks

```bash
#!/bin/bash
# ~/.perry/userscripts/03-symlinks.sh

# Link synced config directories
ln -sf ~/.synced-nvim ~/.config/nvim
ln -sf ~/.synced-tmux/.tmux.conf ~/.tmux.conf
```

### Start Background Services

```bash
#!/bin/bash
# ~/.perry/userscripts/99-services.sh

# Start any background services needed
# (Note: prefer using Docker services when possible)
```

## Path Expansion

- `~` expands to home directory on host
- Scripts are copied to container and executed there
- Absolute paths work as-is

## Apply Changes

Scripts run:
- When creating new workspaces
- When starting stopped workspaces

Scripts do **not** run when syncing (`perry sync`) - only file sync occurs.

## Debugging

Check script output in workspace logs:

```bash
perry logs myworkspace
```

Or connect to the workspace and check manually:

```bash
perry shell myworkspace
```
