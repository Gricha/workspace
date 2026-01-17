---
sidebar_position: 5
---

# Sync and Update

Use these commands to keep workspaces aligned with host configuration and Perry versions.

## Sync credentials and configs

Sync one workspace:

```bash
perry sync myproject
```

Sync all running workspaces:

```bash
perry sync --all
```

Run sync when you update credentials, files, or agent settings.

## Update Perry

```bash
perry update
```

This updates the binary and restarts the agent if it is running. After updating, run:

```bash
perry sync --all
```

## Build the workspace image locally

```bash
perry build
```

Use this if you do not want to pull the prebuilt image.
