---
sidebar_position: 4
---

# Multi-Workspace Development

## Working on Related Projects

```bash
# Create workspaces for different services
perry start frontend --clone https://github.com/user/frontend.git
perry start backend --clone https://github.com/user/backend.git
perry start shared-lib --clone https://github.com/user/shared.git

# List all workspaces
perry list
```

## Branching Strategy with Clones

When working on a feature that might break things:

```bash
# Clone your stable workspace
perry clone main-project feature-experiment

# Work on the feature in the clone
perry shell feature-experiment

# If it works, you can delete the original and rename
# Or just continue working in the clone
```
