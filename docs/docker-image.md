# Docker Image

Pre-built Docker images are available from GitHub Container Registry.

## Pulling the Image

```bash
docker pull ghcr.io/subroutinecom/workspace:latest
```

Specific versions are also available:

```bash
docker pull ghcr.io/subroutinecom/workspace:0.1.0
docker pull ghcr.io/subroutinecom/workspace:0.1
docker pull ghcr.io/subroutinecom/workspace:0
```

## Using Pre-built Images

Instead of building locally with `ws build`, you can use the pre-built image:

```bash
docker tag ghcr.io/subroutinecom/workspace:latest workspace:latest
```

The workspace CLI will then use this image when creating workspaces.

## Available Platforms

Images are built for:
- `linux/amd64` (x86_64)
- `linux/arm64` (Apple Silicon, Raspberry Pi 4+)

## Image Contents

The workspace image includes:

- **OS**: Ubuntu 24.04 LTS
- **Docker**: Docker CE + Compose + BuildKit (Docker-in-Docker)
- **Languages**: Node.js 22, Python 3, Go 1.23, Deno
- **Editor**: Neovim v0.11.4 + LazyVim
- **AI Tools**: Claude Code, OpenCode, Codex CLI
- **CLI Tools**: Git, GitHub CLI, AWS CLI, ripgrep, fd-find, lazygit, jq
- **User**: `workspace` with passwordless sudo

## Building Locally

If you prefer to build locally or need customizations:

```bash
ws build
```

Or directly with Docker:

```bash
docker build -t workspace:latest ./workspace
```

## Security

- Images are built and signed by GitHub Actions
- Source is verified from the repository
- Multi-platform builds use QEMU for cross-compilation
