---
sidebar_position: 2
---

# Installation

## Prerequisites

- Docker
- SSH client

## Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash
```

This downloads and installs the pre-built binary for your platform to `~/.perry/bin`.

### Options

```bash
# Install specific version
curl -fsSL https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash -s -- --version 0.1.8

# Don't modify PATH
curl -fsSL https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash -s -- --no-modify-path
```

## From Source

```bash
git clone https://github.com/gricha/perry.git
cd perry
bun install
bun run build
bun link
```

## Build Base Image

```bash
perry build
```

Builds the Ubuntu 24.04 base image with dev tools. Takes 5-10 minutes, only needed once.

## Verify

```bash
perry info
```
