---
sidebar_position: 1
---

# Workspaces

A **workspace** is an isolated, containerized development environment managed by the Workspace agent. Each workspace runs as a Docker container with Docker-in-Docker capabilities, providing a complete Linux environment with development tools.

## What is a Workspace?

Think of a workspace as a fully-featured development machine that:

- Runs in complete isolation from your host system
- Contains all necessary development tools and runtimes
- Persists your code and data across restarts
- Can be accessed via SSH, web terminal, or API
- Supports running Docker containers inside it

## Workspace Lifecycle

### Creation

When you create a workspace:

1. A unique Docker container is created from the base `workspace:latest` image
2. A persistent volume is attached for the `/home/workspace` directory
3. Configured credentials (environment variables, files) are injected
4. SSH daemon is started on a dynamically assigned port (2200-2400 range)
5. If a Git repository was specified, it's cloned to `/home/workspace/repo`
6. Post-start scripts run (if configured)

```bash
ws create myproject --clone git@github.com:user/repo.git
```

### Running State

A running workspace:

- Consumes system resources (CPU, memory, disk)
- Accepts SSH connections on its assigned port
- Can execute commands and run processes
- Has Docker daemon running inside (Docker-in-Docker)
- Maintains web terminal connections

### Stopped State

When stopped:

- The container is stopped but not removed
- Data in the persistent volume remains intact
- No SSH or terminal access available
- No resource consumption (except disk space)
- Can be restarted instantly

```bash
ws stop myproject
ws start myproject
```

### Deletion

Deleting a workspace:

- Removes the container
- Deletes the persistent volume (all data lost)
- Frees the SSH port
- Cannot be undone

```bash
ws delete myproject
```

:::warning
Deletion is permanent. All code, files, and configuration inside the workspace are lost.
:::

## Workspace Storage

Each workspace has persistent storage:

- **Volume Name**: `workspace-{name}`
- **Mount Point**: `/home/workspace`
- **Persistence**: Data survives container restarts
- **Deletion**: Volume is deleted when workspace is deleted

Your code, installed packages, and configuration files are stored here. The Docker-in-Docker data is also persisted in separate volumes.

## Workspace Networking

### SSH Access

Each workspace gets a unique SSH port:

- **Port Range**: 2200-2400
- **Assignment**: Automatic, sequential
- **User**: `workspace`
- **Authentication**: SSH keys from host (if configured) or password

### Container Networking

Workspaces can:

- Access the internet (for package installation, git operations)
- Run services on any port inside the container
- Expose ports via SSH port forwarding
- Access other Docker containers via Docker-in-Docker

### Internal Services

Each workspace runs:

- **SSH Daemon**: Port 22 (mapped to host port 2200-2400)
- **Docker Daemon**: Unix socket at `/var/run/docker.sock`

## Workspace Isolation

Workspaces are isolated from:

- **Host System**: Cannot access host files except configured mounts
- **Other Workspaces**: Each runs in its own network namespace
- **Docker Daemon**: Uses Docker-in-Docker, not the host Docker socket

This isolation ensures:

- No conflicts between projects
- Safe experimentation without affecting host
- Clean teardown with no residual state

## Resource Management

### CPU and Memory

Workspaces share host resources:

- No hard limits by default
- Can be constrained via Docker flags (future feature)
- Monitor usage in the web UI workspace details

### Disk Space

Each workspace consumes disk space for:

- Container filesystem layers
- Persistent volume (`/home/workspace`)
- Docker-in-Docker images and containers

Monitor with:

```bash
docker system df
```

Clean up unused Docker resources:

```bash
# Inside a workspace
docker system prune
```

## Workspace Identity

Each workspace has:

- **Name**: Unique identifier (e.g., "myproject")
- **Container ID**: Docker container ID
- **Container Name**: `workspace-{name}`
- **Volume Name**: `workspace-{name}`
- **SSH Port**: Assigned from 2200-2400 range

## Best Practices

### Naming

Choose descriptive workspace names:

- Use lowercase letters, numbers, hyphens
- Reflect the project or purpose
- Examples: `api-server`, `ml-training`, `frontend-dev`

### Organization

Organize workspaces by:

- **Project**: One workspace per project
- **Environment**: Separate dev, staging, testing workspaces
- **Technology**: Different workspaces for different tech stacks

### Maintenance

Regularly:

- Stop unused workspaces to free resources
- Delete abandoned workspaces
- Update the base image and recreate workspaces for latest tools

### Data Backup

Important data should be:

- Committed to Git and pushed to remote repositories
- Backed up outside the workspace
- Not relied upon to persist indefinitely in the workspace volume

## Limitations

Current workspace limitations:

- No built-in backup/restore functionality
- No migration between hosts
- No resource limits (CPU/memory) via UI
- SSH port range is fixed (2200-2400)

## Next Steps

- [Learn about Architecture](./architecture.md)
- [Understand Docker-in-Docker](./docker-in-docker.md)
- [Configure Workspaces](../configuration/overview.md)
