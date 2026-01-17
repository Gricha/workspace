---
sidebar_position: 2
---

# Setting Up Development Environment

## Quick Start for a New Project

```bash
# Create workspace with a git repo
perry start my-app --clone https://github.com/user/repo.git

# Open a shell
perry shell my-app

# Or use an AI agent
claude
```

## Syncing After Credential Changes

If you update your credentials or SSH keys on the host:

```bash
perry sync my-app
```

Or use the "Sync Credentials" button in the Web UI settings.
