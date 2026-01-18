---
sidebar_position: 1
---

# OpenCode Workflow

OpenCode runs as a server inside each workspace. This lets you connect from the CLI, web UI, or mobile without SSH.

## Demo

<video controls src="/video/opencode-perry.mov" width="100%"></video>

OpenCode is directly accessible via the web on mobile:

<img src="/img/opencode-mobile.png" alt="OpenCode mobile client" width="360" />

## 1) Configure OpenCode

Sign in on the host and let Perry sync your OpenCode config into workspaces:

- `~/.config/opencode/opencode.json`
- `~/.local/share/opencode/auth.json`

Then set the server settings:

```json
{
  "agents": {
    "opencode": {
      "server": {
        "hostname": "0.0.0.0",
        "username": "opencode",
        "password": "your-password"
      }
    }
  }
}
```

- `server.hostname` controls the bind address for `opencode serve`.
- `username`/`password` enable HTTP basic auth for remote access.

## 2) Start a workspace

```bash
perry start myproject
```

Perry starts `opencode serve` in the workspace on port 4096 when the binary is available.

## 3) Attach from a local machine

```bash
opencode attach http://myproject:4096
```

If Tailscale is enabled, `myproject` is the workspace hostname. Otherwise use the host IP and a forwarded port.

## 4) Use the web UI

Open the OpenCode web UI directly. On a tailnet, you can reach it on the workspace hostname and port 4096:

```
http://project1:4096
```

If you set a server password, your client or browser will prompt for credentials.

## Notes

- For non-Tailscale setups, use `perry proxy` to forward 4096.
- You can also attach a TUI to a running OpenCode server from another terminal.
