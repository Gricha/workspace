---
sidebar_position: 2
---

# Quickstart

Get a remote, isolated workspace running in minutes.

## 1) Install

```bash
curl -fsSL https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash
```

Alternative installs and build-from-source are in [Installation](./installation.md).

## 2) Start the agent

Run this on the machine that will host workspaces:

```bash
perry agent run
```

Web UI is at `http://localhost:7391`.

## 3) Create a workspace

```bash
perry start myproject
```

Or clone a repo on creation:

```bash
perry start myproject --clone git@github.com:user/repo.git
```

## 4) Connect

```bash
perry shell myproject
```

You can also use the Web UI terminal, or SSH if the workspace is on your tailnet.

## 5) Optional: Tailscale

If Tailscale is configured, each workspace gets a tailnet hostname and your agent is reachable remotely.
Start with [Networking](./networking.md) when you are ready.

## Next steps

- [Workspaces](./workspaces.md)
- [Connect](./connect.md)
- [Agents](./agents.md)
- [Configuration](./configuration/overview.md)
