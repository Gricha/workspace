---
sidebar_position: 3
---

# Getting Started

## Start Agent

```bash
ws agent start
```

Web UI: `http://localhost:8420`

Options:
```bash
ws agent start --port 3000     # Custom port
ws agent start --host 0.0.0.0  # Remote access
```

## Create Workspace

CLI:
```bash
ws create myproject
ws create myproject --clone git@github.com:user/repo.git
```

Web UI:
1. Open `http://localhost:8420`
2. Click "+"
3. Enter name
4. Create

## Access

SSH:
```bash
ws list  # Find port
ssh -p 2201 workspace@localhost
```

Web Terminal: Click workspace → Terminal

## Commands

```bash
ws list              # List all
ws start <name>      # Start
ws stop <name>       # Stop
ws delete <name>     # Delete
ws logs <name>       # Logs
ws agent stop        # Stop agent
```
