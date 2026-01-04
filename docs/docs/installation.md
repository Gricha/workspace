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

Takes 5-10 minutes. Only needed once.

## Verify

```bash
ws doctor
```
