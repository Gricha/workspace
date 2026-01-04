---
sidebar_position: 3
---

# Docker-in-Docker

Workspace containers use **Docker-in-Docker** (DinD), allowing you to run Docker commands and containers inside your workspace. This is essential for modern development workflows.

## What is Docker-in-Docker?

Docker-in-Docker means running the Docker daemon inside a Docker container. In Workspace:

- The host machine runs Docker
- Each workspace is a Docker container
- Inside each workspace, Docker daemon runs
- You can use `docker` commands inside the workspace
- Containers created inside workspaces are isolated from the host

## Why Docker-in-Docker?

Many modern development workflows require Docker:

### Container Development
Build and test Docker images for your application:

```bash
# Inside workspace
docker build -t myapp .
docker run -p 3000:3000 myapp
```

### Docker Compose
Develop and test multi-container applications:

```bash
# Inside workspace
docker-compose up -d
docker-compose logs -f
```

### CI/CD Development
Test CI/CD pipelines locally before pushing:

```bash
# Inside workspace
# Reproduce exact build environment
docker run --rm -v $(pwd):/workspace -w /workspace node:22 npm test
```

### Microservices
Run multiple services during development:

```bash
# Inside workspace
docker run -d postgres:15
docker run -d redis:7
docker run -d rabbitmq:3
```

## How it Works

### Container Privilege

Workspace containers run with `--privileged` flag, granting necessary permissions for Docker-in-Docker.

### Docker Daemon

Each workspace runs its own Docker daemon:

- Started automatically when workspace container starts
- Listens on Unix socket `/var/run/docker.sock`
- Isolated from other workspaces and host

### Storage

Docker-in-Docker data is stored in:

- **Images**: `/var/lib/docker/image`
- **Containers**: `/var/lib/docker/containers`
- **Volumes**: `/var/lib/docker/volumes`

This data persists across workspace restarts but is lost when workspace is deleted.

## Using Docker Inside Workspaces

### Basic Commands

All standard Docker commands work:

```bash
# Pull images
docker pull ubuntu:22.04

# Run containers
docker run -it ubuntu:22.04 bash

# Build images
docker build -t myimage .

# Manage containers
docker ps
docker stop <container>
docker rm <container>

# Clean up
docker system prune
```

### Docker Compose

Docker Compose is pre-installed:

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### BuildKit

BuildKit is enabled by default for faster builds:

```bash
# BuildKit features work automatically
docker build --secret id=mysecret,src=./secret.txt .
```

## Networking

### Container-to-Container

Containers inside a workspace can communicate:

```bash
# Create network
docker network create mynetwork

# Run containers on same network
docker run -d --network mynetwork --name db postgres
docker run -d --network mynetwork --name app myapp
```

### Port Mapping

Expose container ports to workspace:

```bash
# Map port 3000 inside container to workspace
docker run -p 3000:3000 myapp

# Access from SSH port forwarding
ssh -L 3000:localhost:3000 -p 2201 workspace@localhost
# Now access localhost:3000 on your machine
```

### Internet Access

Containers inside workspaces have internet access:

```bash
docker run --rm ubuntu:22.04 apt-get update
docker run --rm alpine ping -c 3 google.com
```

## Storage and Volumes

### Anonymous Volumes

Docker automatically creates volumes:

```bash
docker run -v /data myapp
# Volume is inside workspace's Docker
```

### Named Volumes

Create persistent volumes inside workspace:

```bash
# Create volume
docker volume create pgdata

# Use in container
docker run -v pgdata:/var/lib/postgresql/data postgres
```

### Bind Mounts

Mount workspace files into containers:

```bash
# Mount current directory
docker run -v $(pwd):/app node:22 npm install

# Mount specific path
docker run -v ~/code:/code myapp
```

## Performance Considerations

### Storage Driver

Workspace uses `overlay2` storage driver for good performance.

### Resource Limits

Containers inside workspaces share the workspace's resources. Monitor usage:

```bash
docker stats
```

### Cleanup

Regularly clean up unused resources:

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Clean everything
docker system prune -a
```

## Limitations

### Nested DinD

You cannot run Docker-in-Docker-in-Docker:

```bash
# This won't work
docker run --privileged docker:dind
```

### Security

Running containers with `--privileged` has security implications:

- Container has elevated privileges
- Can potentially access host kernel features
- Use only on trusted networks
- Don't expose workspace SSH ports to the internet

### Performance

Docker-in-Docker has overhead:

- Slightly slower than native Docker
- More disk space usage
- Additional memory for Docker daemon

## Best Practices

### Image Management

Pull images once, reuse across projects:

```bash
# Pull base images
docker pull node:22
docker pull python:3.11
docker pull postgres:15
```

### Cleanup Schedule

Set up periodic cleanup:

```bash
# Add to workspace crontab
0 2 * * * docker system prune -f
```

### Layer Caching

Use BuildKit layer caching for faster builds:

```bash
# Multi-stage builds cache better
FROM node:22 AS builder
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
```

### Volume Strategy

Use named volumes for important data:

```bash
# Database data
docker run -v pgdata:/var/lib/postgresql/data postgres

# Redis data
docker run -v redisdata:/data redis
```

## Troubleshooting

### Docker Daemon Not Starting

If Docker daemon fails to start inside workspace:

```bash
# Check daemon status
systemctl status docker

# View daemon logs
journalctl -u docker -n 50

# Restart daemon
sudo systemctl restart docker
```

### Disk Space Issues

If you run out of disk space:

```bash
# Check usage
docker system df

# Clean up
docker system prune -a --volumes

# Remove specific items
docker image prune -a
docker volume prune
```

### Permission Errors

If you get permission errors:

```bash
# Ensure docker group membership
sudo usermod -aG docker workspace

# Restart workspace for group changes
# (exit SSH, then: ws restart <name>)
```

## Examples

### Full Stack Development

```bash
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: secret

  redis:
    image: redis:7

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - db
      - redis

volumes:
  pgdata:
```

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f app

# Scale services
docker-compose up -d --scale worker=3
```

### Testing Different Environments

```bash
# Test on Ubuntu 22.04
docker run -it -v $(pwd):/app ubuntu:22.04 bash
cd /app && ./test.sh

# Test on Alpine
docker run -it -v $(pwd):/app alpine:latest sh
cd /app && ./test.sh

# Test on specific Node version
docker run -it -v $(pwd):/app node:18 bash
cd /app && npm test
```

## Next Steps

- [Configure Workspaces](../configuration/overview.md)
- [Learn about Networking](../advanced/networking.md)
- [Manage Volumes](../advanced/volumes.md)
