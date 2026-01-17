---
sidebar_position: 1
---

# Workspaces

Workspaces are isolated Docker-in-Docker containers with their own persistent volumes. You can create, start, stop, clone, and delete them from any client connected to your agent.

## Create or start

```bash
perry start myproject
```

Clone a repo on first creation:

```bash
perry start myproject --clone git@github.com:user/repo.git
```

## Stop

```bash
perry stop myproject
```

## Delete

```bash
perry delete myproject
```

## List and inspect

```bash
perry list
perry info myproject
```

## Logs

```bash
perry logs myproject
```

## Clone

```bash
perry clone myproject myproject-experiment
```

Cloning copies the home volume and Docker-in-Docker volume, then starts a new container with a new SSH port.

## Notes

- Workspace names must be unique and use lowercase letters, numbers, and dashes.
- Ports are assigned automatically; see [Networking](./networking.md) for access.
