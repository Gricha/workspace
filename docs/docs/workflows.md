---
sidebar_position: 6
---

# Common Workflows

This guide covers common workflows and use cases for Perry workspaces.

## Cloning Workspaces

When you need to experiment with changes without affecting your main workspace, or want to create a backup before making risky modifications, you can clone a workspace.

### Via CLI

```bash
perry clone myproject myproject-experiment
```

### Via Web UI

1. Open the workspace you want to clone
2. Click the clone icon (next to the settings gear) in the navbar, or
3. Go to Settings and click "Clone" in the Clone Workspace section
4. Enter a name for the new workspace
5. Click "Clone Workspace"

### Via Mobile App

1. Open the workspace details
2. Go to Settings
3. Tap "Clone Workspace" in the Clone section
4. Enter a name for the new workspace
5. Tap "Clone"

### What Gets Cloned

- All files in `/home/workspace` (your code, configurations, etc.)
- Docker-in-Docker state (containers, images, volumes)
- A new SSH port is assigned automatically

### Notes

- The source workspace is temporarily stopped during cloning to ensure data consistency
- After cloning, both workspaces can run independently
- Credentials are synced to the new workspace automatically

## Setting Up Development Environment

### Quick Start for a New Project

```bash
# Create workspace with a git repo
perry start my-app --clone https://github.com/user/repo.git

# Open a shell
perry shell my-app

# Or use an AI agent
claude
```

### Syncing After Credential Changes

If you update your credentials or SSH keys on the host:

```bash
perry sync my-app
```

Or use the "Sync Credentials" button in the Web UI settings.

## Port Forwarding

When running web servers or services in your workspace:

### Configure Persistent Ports

```bash
# Set ports that auto-forward with perry proxy
perry ports my-app 3000 5173

# Forward them
perry proxy my-app
```

### One-Time Port Forward

```bash
# Forward specific ports without saving
perry proxy my-app 8080:3000  # Local 8080 -> workspace 3000
```

## Multi-Workspace Development

### Working on Related Projects

```bash
# Create workspaces for different services
perry start frontend --clone https://github.com/user/frontend.git
perry start backend --clone https://github.com/user/backend.git
perry start shared-lib --clone https://github.com/user/shared.git

# List all workspaces
perry list
```

### Branching Strategy with Clones

When working on a feature that might break things:

```bash
# Clone your stable workspace
perry clone main-project feature-experiment

# Work on the feature in the clone
perry shell feature-experiment

# If it works, you can delete the original and rename
# Or just continue working in the clone
```

## Using AI Agents

### Claude Code

```bash
perry shell my-app
claude
```

Or use the Web UI's chat interface directly.

### OpenCode

```bash
perry shell my-app
opencode
```

### Codex

```bash
perry shell my-app
codex
```

## Troubleshooting Common Issues

### Workspace Won't Start

```bash
# Check logs
perry logs my-app

# If container was deleted externally, starting will recreate it
perry start my-app
```

### Credentials Not Working

```bash
# Re-sync credentials
perry sync my-app

# Check what files are configured
perry config agent
```

### SSH Connection Issues

```bash
# Check SSH configuration
perry ssh show

# Verify authorized keys
perry ssh list
```
