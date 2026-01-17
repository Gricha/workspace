---
sidebar_position: 7
---

# Tailscale Integration

Perry integrates with [Tailscale](https://tailscale.com) in two powerful ways:

1. **Agent Access** - Access your Perry agent remotely from any device on your tailnet
2. **Workspace Networking** - Give each workspace its own hostname on your tailnet for direct access to services

## Quick Start

Already have Tailscale? Here's the 2-minute setup:

```bash
# 1. Generate an auth key at https://login.tailscale.com/admin/settings/keys
#    - Reusable: Yes
#    - Ephemeral: No

# 2. Open Perry Web UI and configure
open http://localhost:7391
# Go to Settings > Configuration > Networking section, paste your key, click Save

# 3. Start a workspace - it will join your tailnet automatically
perry start myproject

# 4. Access it from anywhere on your tailnet
curl http://myproject:3000
ssh workspace@myproject
```

That's it! Read on for detailed setup and advanced configuration.

---

## Why Use Tailscale with Perry?

### Without Tailscale

- Workspaces are only accessible from the host machine
- You need to remember and manage port mappings (e.g., `localhost:3000`, `localhost:8080`)
- No remote access to your development environment
- Services can only be accessed via forwarded ports

### With Tailscale

- Access your Perry agent from anywhere (laptop, phone, tablet)
- Each workspace gets its own hostname on your tailnet (e.g., `myproject`)
- Direct access to any port on any workspace via MagicDNS
- Secure, encrypted connections without exposing ports to the internet
- Share development URLs with teammates on your tailnet

## Part 1: Agent Access (Tailscale Serve)

This lets you access the Perry agent (Web UI, API) from any device on your tailnet.

### Setup

#### 1. Install Tailscale

Follow the [Tailscale installation guide](https://tailscale.com/download) for your platform.

#### 2. Enable HTTPS (Recommended)

Enable HTTPS certificates in your [Tailscale admin console](https://login.tailscale.com/admin/dns).

#### 3. Set Operator Permissions

Allow Perry to use Tailscale Serve without sudo:

```bash
sudo tailscale set --operator=$USER
```

This only needs to be done once per machine.

#### 4. Start Perry

```bash
perry agent run
```

If Tailscale is configured, you'll see:

```
[agent] Tailscale detected: your-machine.tail-scale.ts.net
[agent] Tailscale Serve enabled
[agent] Agent running at http://localhost:7391
[agent] Tailscale HTTPS: https://your-machine.tail-scale.ts.net
```

### Remote Access to Agent

**From another machine on your tailnet:**

```bash
# Configure CLI to use remote agent
perry config agent your-machine.tail-scale.ts.net

# Use normally
perry list
perry start myproject
perry shell myproject
```

**From browser:**

- `https://your-machine.tail-scale.ts.net` (with HTTPS)
- `http://your-machine.tail-scale.ts.net:7391` (without HTTPS)

**From another device:**

Access the Web UI from any browser on your tailnet.

## Part 2: Workspace Networking

This is the game-changer. Each workspace can join your tailnet and get its own hostname, making services directly accessible.

### Why Workspace Networking?

Imagine you're working on a web app in a workspace called `myproject`. Instead of:

```
http://localhost:3000  # Only works on host machine
```

You get:

```
http://myproject:3000  # Works from any device on your tailnet
```

**Use cases:**

- Test a dev server running in a workspace from another device
- Share a preview URL with a teammate: "Check out `http://myproject:3000`"
- Access databases, Redis, or any service running in a workspace
- Connect your IDE on one machine to a workspace running on another
- SSH directly into workspaces: `ssh workspace@myproject`

### Setup

#### 1. Generate a Tailscale Auth Key

1. Go to [Tailscale Admin Console > Settings > Keys](https://login.tailscale.com/admin/settings/keys)
2. Click **Generate auth key**
3. Configure the key:
   - **Reusable**: Yes (so multiple workspaces can use it)
   - **Ephemeral**: Yes (recommended) or No - see note below
   - **Tags**: Optional, for ACL control
   - **Expiration**: Set based on your security needs
4. Copy the key (starts with `tskey-auth-`)

:::tip Ephemeral vs Non-Ephemeral Keys
**Ephemeral keys (recommended)**: Workspaces auto-deregister from your tailnet after being offline for a period. This is ideal because:
- Automatic cleanup if a workspace crashes or is force-removed
- No orphaned devices cluttering your tailnet
- Workspaces re-register automatically on every start

**Non-ephemeral keys**: Workspaces persist on your tailnet even when stopped. Use this if you want to see offline workspaces in your Tailscale admin console.

Perry always attempts to deregister workspaces on delete regardless of key type, but ephemeral keys provide a safety net for edge cases.
:::

#### 2. Configure Perry

There are several ways to configure your Tailscale auth key:

**Option A: Web UI Setup Wizard (First-time users)**

When you first open Perry's Web UI, you'll be guided through a setup wizard that includes a **Networking** step for Tailscale configuration.

**Option B: CLI Setup Wizard**

Run the interactive setup wizard:

```bash
perry agent config
```

This walks you through configuring AI agents, GitHub, SSH keys, and Tailscale networking.

**Option C: Web UI Settings (Recommended)**

1. Open http://localhost:7391
2. Go to **Settings > Configuration** in the sidebar
3. Scroll down to the **Networking** section
4. Enable Tailscale and paste your auth key
5. Click **Save**

The Configuration page shows Tailscale alongside other service configurations (AI agents, GitHub).

**Option D: Direct config.json edit**

Edit `~/.config/perry/config.json`:

```json
{
  "tailscale": {
    "authKey": "tskey-auth-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

**Option E: Environment variable**

Set the auth key via environment variable when starting the agent:

```bash
PERRY_TAILSCALE_AUTH_KEY="tskey-auth-..." perry agent run
```

:::tip Which method should I use?
- **New to Perry?** Use the Web UI Settings page - it's the most user-friendly
- **Scripting/automation?** Use the config.json file or environment variable
- **Quick setup?** The Web UI at Settings > Tailscale is fastest
:::

#### 3. Start or Restart Workspaces

Workspaces created after configuring Tailscale will automatically join your tailnet.

For existing workspaces, restart them:

```bash
perry stop myproject
perry start myproject
```

### How It Works

When a workspace starts with Tailscale configured:

1. The container starts with the `TS_AUTHKEY` environment variable
2. The Tailscale daemon (`tailscaled`) starts inside the container
3. The workspace runs `tailscale up --hostname={prefix}{workspace-name}`
4. The workspace appears on your tailnet (e.g., `myproject` or `perry-myproject` if you set a prefix)
5. All ports on the workspace are accessible via this hostname

:::tip Hostname Prefix
By default, workspaces use their name directly as the hostname (e.g., `myproject`). You can optionally set a prefix in Settings > Tailscale to distinguish Perry workspaces. If you want a dash separator, include it in the prefix (e.g., `perry-` results in `perry-myproject`).
:::

When a workspace is deleted:

1. Perry runs `tailscale logout` to deregister from your tailnet
2. The hostname is removed from your tailnet

### Accessing Workspaces

Once configured, access any service in any workspace:

```bash
# Web server on port 3000
curl http://myproject:3000

# API on port 8080
curl http://backend:8080/api/health

# Database
psql -h myproject -U postgres

# Redis
redis-cli -h myproject

# SSH into workspace
ssh workspace@myproject
```

### Viewing Tailscale Status

**Web UI:**

Workspace cards show the Tailscale hostname when connected.

**CLI:**

```bash
perry list
```

Shows Tailscale hostname for each workspace.

**Inside workspace:**

```bash
tailscale status
```

### Example: Full Workflow

```bash
# 1. Configure Tailscale (one-time)
# Go to Settings > Configuration in Web UI and add your auth key in the Networking section

# 2. Create a workspace
perry start myproject --clone https://github.com/myuser/myapp

# 3. Inside the workspace, start your dev server
npm run dev  # Starts on port 3000

# 4. From any device on your tailnet:
# - Browser: http://myproject:3000
# - Mobile: Same URL
# - Another terminal: curl http://myproject:3000
```

## Security Considerations

### Tailscale Security Model

- All traffic is encrypted via WireGuard
- Only devices on your tailnet can access workspaces
- No ports are exposed to the public internet
- Tailscale handles authentication and key rotation

### Auth Key Security

- Store your auth key securely (Perry stores it in `~/.config/perry/config.json`)
- Use short-lived keys in shared environments
- Consider tagged keys with ACLs for team use
- Revoke keys in the Tailscale admin console if compromised

### Workspace Isolation

Each workspace is still an isolated Docker container. Tailscale networking adds accessibility, not reduces isolation:

- Workspaces can't access each other unless explicitly configured
- Host filesystem access is controlled by Perry settings
- Network policies can be enforced via Tailscale ACLs

## Troubleshooting

### Agent: "Tailscale Serve requires operator permissions"

```
[agent] Tailscale Serve requires operator permissions
[agent] To enable: Run: sudo tailscale set --operator=$USER
[agent] Continuing without HTTPS...
```

**Fix:** Run `sudo tailscale set --operator=$USER` and restart the agent.

### Agent: "Tailscale HTTPS not enabled in tailnet"

Enable HTTPS certificates in your [Tailscale DNS settings](https://login.tailscale.com/admin/dns).

### Agent: Tailscale Not Detected

Verify Tailscale is running:

```bash
tailscale status
```

### Workspace: Not Appearing on Tailnet

1. Check the auth key is configured in Settings > Configuration > Networking
2. Restart the workspace: `perry stop myproject && perry start myproject`
3. Check container logs: `docker logs workspace-myproject`
4. Verify tailscaled is running inside: `docker exec workspace-myproject tailscale status`

### Workspace: Hostname Not Resolving

1. Ensure MagicDNS is enabled in your [Tailscale admin console](https://login.tailscale.com/admin/dns)
2. Check the workspace is connected: `tailscale status` (look for your workspace name)
3. Try the full hostname: `myproject.your-tailnet.ts.net`

### Auth Key Expired or Invalid

1. Generate a new key in the [Tailscale admin console](https://login.tailscale.com/admin/settings/keys)
2. Update it in Settings > Configuration > Networking
3. Restart affected workspaces

### Check Agent Info

```bash
perry info
```

Shows Tailscale status including DNS name and HTTPS URL if available.

## Behavior Summary

### Agent (Tailscale Serve)

| Scenario | Behavior |
|----------|----------|
| Tailscale not installed | Agent runs on localhost only |
| Tailscale running, HTTPS enabled, operator set | HTTPS via Tailscale Serve |
| Tailscale running, HTTPS enabled, no operator | Logs instructions, localhost only |
| Tailscale running, HTTPS not enabled | Agent accessible via Tailscale IP |

### Workspaces

| Scenario | Behavior |
|----------|----------|
| No auth key configured | Workspaces don't join tailnet |
| Auth key configured, workspace starting | Joins/re-joins tailnet as `{prefix}{name}` |
| Auth key configured, workspace stopping | Depends on key type (ephemeral auto-removes after timeout) |
| Auth key configured, workspace deleted | Perry runs `tailscale logout` for immediate removal |

## Advanced: Tailscale ACLs

For team environments, use Tailscale ACLs to control access:

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["group:developers"],
      "dst": ["tag:perry-workspace:*"]
    }
  ],
  "tagOwners": {
    "tag:perry-workspace": ["autogroup:admin"]
  }
}
```

Then generate auth keys with the `tag:perry-workspace` tag.

## Further Reading

- [Tailscale Documentation](https://tailscale.com/kb)
- [Tailscale Serve](https://tailscale.com/kb/1312/serve)
- [Tailscale Auth Keys](https://tailscale.com/kb/1085/auth-keys)
- [Tailscale ACLs](https://tailscale.com/kb/1018/acls)
- [MagicDNS](https://tailscale.com/kb/1081/magicdns)
