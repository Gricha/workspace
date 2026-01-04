---
sidebar_position: 5
---

# CLI

## Agent

```bash
ws agent start [--port PORT] [--host HOST]
ws agent stop
ws agent status
```

## Workspaces

```bash
ws create <name> [--clone URL]
ws start <name>
ws stop <name>
ws delete <name> [-f]
ws list
ws logs <name> [-f]
```

## Build

```bash
ws build [--no-cache]
ws doctor
```
