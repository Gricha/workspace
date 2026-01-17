---
sidebar_position: 1
---

# Cloning Workspaces

When you need to experiment with changes without affecting your main workspace, or want to create a backup before making risky modifications, you can clone a workspace.

## Via CLI

```bash
perry clone myproject myproject-experiment
```

## Via Web UI

1. Open the workspace you want to clone
2. Click the clone icon (next to the settings gear) in the navbar, or
3. Go to Settings and click "Clone" in the Clone Workspace section
4. Enter a name for the new workspace
5. Click "Clone Workspace"

## What Gets Cloned

- All files in `/home/workspace` (your code, configurations, etc.)
- Docker-in-Docker state (containers, images, volumes)
- A new SSH port is assigned automatically

## Notes

- The source workspace is temporarily stopped during cloning to ensure data consistency
- After cloning, both workspaces can run independently
- Credentials are synced to the new workspace automatically
