---
sidebar_position: 5
---

# CLI

## Agent

```bash
perry agent run [--port PORT]
perry agent install
perry agent uninstall
perry agent status
```

## Workspaces

```bash
perry start <name> [--clone URL]  # Start (creates if doesn't exist)
perry stop <name>
perry delete <name>
perry list
perry logs <name>
perry sync <name>
```

## Build

```bash
perry build [--no-cache]
```

## Configuration

```bash
perry config show
perry config worker [hostname]
perry config agent
```
