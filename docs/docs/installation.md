---
sidebar_position: 2
---

# Installation

## Prerequisites

- Docker
- Node.js 18+ or Bun
- SSH client

## Install

```bash
npm install -g @subroutinecom/workspace
```

From source:
```bash
git clone https://github.com/subroutinecom/workspace.git
cd workspace
bun install
bun run build
bun link
```

## Build Base Image

```bash
ws build
```

Builds the Ubuntu 24.04 base image with dev tools. Takes 5-10 minutes, only needed once.

## Verify

```bash
ws doctor
```
