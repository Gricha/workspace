---
sidebar_position: 7
---

# Mobile

The mobile app is for lightweight workspace management and quick terminal access from anywhere on your tailnet. It is not intended to replace a full development environment.

The apps are not currently distributed via App Store or Play Store. You need to build and run them locally.

## What it’s good for

- Start/stop workspaces while away from your desk
- Jump into a quick terminal session to check status or run a command
- Monitor running workspaces

## Setup

Install the Perry mobile app and configure the agent hostname in the app settings.

If your agent is on Tailscale, use the tailnet hostname. Otherwise use the LAN hostname/IP and port.

## Build from source

```bash
cd mobile
bun install
```

### iOS

```bash
bunx expo run:ios --device "<Your iPhone Name>" --no-bundler
bunx expo start --dev-client
```

### Android

```bash
bunx expo run:android --device --no-bundler
bunx expo start --dev-client
```

Environment config lives in `mobile/.env.local` (use `EXPO_PUBLIC_` prefix for runtime vars).
