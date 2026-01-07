---
sidebar_position: 2
---

# Installation

## Prerequisites

- **Docker** - [Install Docker](https://docs.docker.com/get-docker/)
- **macOS or Linux** - Windows via WSL2

Verify Docker is running:

```bash
docker info
```

## Install Perry

### Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash
```

This downloads the pre-built binary to `~/.perry/bin` and adds it to your PATH.

### Install Options

```bash
# Specific version
curl -fsSL https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash -s -- --version 0.2.0

# Skip PATH modification
curl -fsSL https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash -s -- --no-modify-path
```

### From Source

```bash
git clone https://github.com/gricha/perry.git
cd perry
bun install
bun run build
bun link
```

## Next Steps

[Get started with your first workspace](./getting-started.md)
