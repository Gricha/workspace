# Authentication

Perry supports bearer token authentication to secure API access. When enabled, all API requests must include a valid authentication token.

## Overview

By default, Perry runs without authentication. This is convenient for local development but not recommended when the agent is accessible over a network. Enable authentication to:

- Prevent unauthorized access to workspace management
- Secure remote access via Tailscale or other networks
- Protect sensitive credentials stored in workspaces

## Generating a Token

### Using the CLI

During initial setup or reconfiguration:

```bash
perry setup
```

Follow the prompts to generate an authentication token. The token will be displayed once and stored securely.

Alternatively, generate a token directly:

```bash
perry auth generate
```

### Using the Web UI

1. Open the Perry web interface
2. Navigate to **Settings > Security**
3. Click **Generate Token** (or **Regenerate Token** if one exists)
4. Copy the displayed token immediately - it won't be shown again

## Configuring Clients

### CLI Configuration

When running `perry setup` against a remote agent with authentication enabled, you'll be prompted to enter the token:

```bash
perry setup --agent http://remote-host:6660
# Enter token when prompted
```

The token is stored in `~/.config/perry/config.json`.

### Web UI

When accessing the web UI of an agent with authentication enabled, you'll be prompted to enter the token. The token is stored in your browser's local storage.

### API Requests

Include the token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer <your-token>" \
  http://localhost:6660/rpc/workspaces.list
```

## Disabling Authentication

### Using the CLI

```bash
perry auth disable
```

### Using the Web UI

1. Navigate to **Settings > Security**
2. Click **Disable Authentication**
3. Confirm the action in the dialog

:::warning
Disabling authentication allows anyone with network access to control your Perry agent. Only disable authentication on trusted networks or for local-only access.
:::

## Regenerating Tokens

If you suspect a token has been compromised, regenerate it immediately:

1. Generate a new token (CLI or Web UI)
2. Update all clients with the new token
3. The old token is automatically invalidated

## Security Considerations

### Network Exposure

- **Local only**: Authentication is optional but recommended
- **Tailscale/VPN**: Enable authentication to protect against compromised tailnet members
- **Public internet**: Always enable authentication and consider additional security measures

### Token Storage

- CLI: Stored in `~/.config/perry/config.json` with file permissions `600`
- Web UI: Stored in browser local storage
- Agent: Stored in the agent's configuration file

### Best Practices

1. Generate unique tokens for each deployment
2. Regenerate tokens periodically
3. Use environment variables for automation instead of hardcoding tokens
4. Monitor access logs for suspicious activity
