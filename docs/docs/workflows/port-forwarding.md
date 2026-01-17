---
sidebar_position: 3
---

# Port Forwarding

When running web servers or services in your workspace, you can forward ports to access them from your local machine.

## Configure Persistent Ports

```bash
# Set ports that auto-forward with perry proxy
perry ports my-app 3000 5173

# Forward them
perry proxy my-app
```

## One-Time Port Forward

```bash
# Forward specific ports without saving
perry proxy my-app 8080:3000  # Local 8080 -> workspace 3000
```
