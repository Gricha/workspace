---
sidebar_position: 6
---

# Web & Mobile

Perry includes a responsive web UI and a native mobile app, giving you access to your workspaces from anywhere.

## Web UI

The web UI is served directly by the Perry agent.

### Accessing

**Locally:**
```
http://localhost:7391
```

**Remotely via Tailscale:**
```
http://<hostname>:7391
```

With [Tailscale Serve](https://tailscale.com/kb/1312/serve) configured, Perry automatically advertises itself over HTTPS at your Tailscale hostname.

### Capabilities

- **Manage workspaces** - Create, start, stop, and delete workspaces
- **Web terminal** - Full terminal access to any workspace
- **AI sessions** - View and resume Claude Code, OpenCode, and Codex sessions
- **Settings** - Configure environment variables, SSH keys, file sync, and agent credentials

### Host Access

By default, Perry also provides direct access to your host machine (not just containers). This lets you run terminals and AI agents on host projects without Docker isolation.

Disable with `perry agent run --no-host-access` if you only want container access.

## Mobile App

The Perry mobile app provides the same capabilities as the web UI in a native experience optimized for iOS and Android.

![Mobile App](/img/demo-terminal-mobile.gif)

### Building for Your Device

The app is built with Expo. To run it on your own device:

**Prerequisites:**
- Node.js or Bun
- Xcode (iOS) or Android Studio (Android)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)

**Development build:**

```bash
cd mobile
bun install

# iOS (requires Mac with Xcode)
bun run ios

# Android
bun run android
```

This builds and installs a development version directly to your connected device or simulator.

**Connecting to your agent:**

The app needs your agent's address. In the app settings, enter your Tailscale hostname (e.g., `myserver:7391` or `myserver.tail1234.ts.net`).

### App Store

An iOS App Store version is coming soon. Follow the [GitHub repository](https://github.com/gricha/perry) for updates.
