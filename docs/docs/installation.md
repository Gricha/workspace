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

## Manual Download

Download pre-built binaries directly from [GitHub Releases](https://github.com/gricha/perry/releases):

| Platform | Architecture | Download |
|----------|--------------|----------|
| Linux | x64 | `perry-VERSION-linux-x64.tar.gz` |
| Linux | arm64 | `perry-VERSION-linux-arm64.tar.gz` |
| macOS | Intel | `perry-VERSION-darwin-x64.tar.gz` |
| macOS | Apple Silicon | `perry-VERSION-darwin-arm64.tar.gz` |
| Windows | x64 | `perry-VERSION-windows-x64.zip` |

Extract and add to your PATH:

```bash
# Linux/macOS
tar -xzf perry-*.tar.gz
sudo mv perry-*/perry /usr/local/bin/
sudo mv perry-*/web /usr/local/share/perry/

# Or install to home directory
mkdir -p ~/.perry/bin
mv perry-*/perry ~/.perry/bin/
mv perry-*/web ~/.perry/
export PATH="$PATH:$HOME/.perry/bin"
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

## Uninstall

To uninstall Perry:

```bash
# Remove binary and web assets
rm -rf ~/.perry

# Remove config and state (optional - keeps your workspaces config)
rm -rf ~/.config/perry

# Remove PATH entries from shell configs
# Edit ~/.bashrc, ~/.zshrc, ~/.profile to remove the Perry lines
```

If you installed with npm:

```bash
npm uninstall -g @gricha/perry
```
