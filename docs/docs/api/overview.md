---
sidebar_position: 1
---

# API Overview

The Workspace agent provides a type-safe HTTP API using [oRPC](https://orpc.unnoq.com/) for programmatic access to workspace management.

## Base URL

```
http://{host}:{port}/rpc
```

Default: `http://localhost:8420/rpc`

## Protocol

oRPC provides a JSON-RPC-like protocol over HTTP with:

- **Type Safety**: Automatic TypeScript type inference
- **Procedure Calls**: Clean client/server communication
- **Error Handling**: Standard error codes
- **Streaming**: Support for real-time data

## Quick Example

```typescript
import { createORPCClient } from '@orpc/client'

const client = createORPCClient({
  baseURL: 'http://localhost:8420/rpc'
})

// List all workspaces
const workspaces = await client.workspaces.list()

// Create a new workspace
const workspace = await client.workspaces.create({
  name: 'myproject',
  clone: 'git@github.com:user/repo.git'
})

// Start a workspace
await client.workspaces.start({ name: 'myproject' })

// Get workspace details
const info = await client.workspaces.get({ name: 'myproject' })
```

## API Endpoints

The API is organized into these main areas:

### Workspaces

CRUD operations for managing workspaces:

- `workspaces.list()` - List all workspaces
- `workspaces.get({ name })` - Get workspace details
- `workspaces.create({ name, clone?, env? })` - Create workspace
- `workspaces.start({ name })` - Start workspace
- `workspaces.stop({ name })` - Stop workspace
- `workspaces.delete({ name })` - Delete workspace
- `workspaces.logs({ name, tail? })` - Get logs

[→ Workspaces API Reference](./endpoints/workspaces.md)

### Sessions

Access AI agent conversation history:

- `sessions.list({ workspace, agent? })` - List sessions
- `sessions.get({ workspace, sessionId })` - Get session details

[→ Sessions API Reference](./endpoints/sessions.md)

### Configuration

Manage agent configuration:

- `config.get()` - Get agent configuration
- `config.update({ credentials, scripts })` - Update configuration

[→ Config API Reference](./endpoints/config.md)

### Terminal

WebSocket-based terminal access:

- `GET /rpc/terminal/{workspaceName}` - WebSocket connection

[→ Terminal API Reference](./endpoints/terminal.md)

### System Info

Get agent and system information:

- `info()` - Get agent info (uptime, version, workspace count)

## Client Libraries

### TypeScript/JavaScript

Official oRPC client:

```bash
npm install @orpc/client
```

```typescript
import { createORPCClient } from '@orpc/client'
import type { AppRouter } from '@subroutinecom/workspace/agent'

const client = createORPCClient<AppRouter>({
  baseURL: 'http://localhost:8420/rpc'
})
```

### cURL

Raw HTTP requests:

```bash
# List workspaces
curl http://localhost:8420/rpc/workspaces.list

# Create workspace
curl -X POST http://localhost:8420/rpc/workspaces.create \
  -H "Content-Type: application/json" \
  -d '{"name":"myproject","clone":"git@github.com:user/repo.git"}'

# Start workspace
curl -X POST http://localhost:8420/rpc/workspaces.start \
  -H "Content-Type: application/json" \
  -d '{"name":"myproject"}'
```

### Python

Using `requests`:

```python
import requests

base_url = "http://localhost:8420/rpc"

# List workspaces
response = requests.get(f"{base_url}/workspaces.list")
workspaces = response.json()

# Create workspace
response = requests.post(
    f"{base_url}/workspaces.create",
    json={"name": "myproject", "clone": "git@github.com:user/repo.git"}
)
workspace = response.json()
```

## Error Handling

oRPC uses standard error codes:

| Code | Description |
|------|-------------|
| `NOT_FOUND` | Workspace doesn't exist |
| `CONFLICT` | Workspace name already exists |
| `BAD_REQUEST` | Invalid parameters |
| `INTERNAL_SERVER_ERROR` | Unexpected error |

Error response format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Workspace 'myproject' not found"
  }
}
```

Handle errors in TypeScript:

```typescript
try {
  await client.workspaces.get({ name: 'nonexistent' })
} catch (error) {
  if (error.code === 'NOT_FOUND') {
    console.log('Workspace not found')
  }
}
```

## Authentication

Currently: **None**

The API is unauthenticated and intended for use on:

- Localhost (default)
- Trusted private networks
- VPN/Tailscale networks

:::warning
Do not expose the agent API to the public internet without adding authentication.
:::

Future versions may include:

- Bearer token authentication
- mTLS (mutual TLS)
- API key authentication

## Rate Limiting

Currently: **None**

The agent has no built-in rate limiting. Consider:

- Running on trusted networks only
- Implementing application-level rate limiting
- Using reverse proxy (nginx, Caddy) for rate limiting

## CORS

The agent enables CORS for browser-based clients:

- Allowed origins: All (`*`) by default
- Allowed methods: GET, POST, PUT, DELETE
- Allowed headers: Content-Type, Authorization

Configure CORS (future feature):

```yaml
# config.yaml
api:
  cors:
    origins: ["http://localhost:3000"]
```

## WebSocket Protocol

Terminal access uses WebSocket, not oRPC:

```
GET /rpc/terminal/{workspaceName}
Upgrade: websocket
```

Binary protocol:
- **Client → Server**: stdin bytes
- **Server → Client**: stdout/stderr bytes
- **Control Messages**: JSON for resize, etc.

See [Terminal API](./endpoints/terminal.md) for details.

## Examples

### Automation Script

```typescript
import { createORPCClient } from '@orpc/client'

const client = createORPCClient({
  baseURL: 'http://localhost:8420/rpc'
})

async function createDevEnvironment(projectName: string, repoUrl: string) {
  // Create workspace
  const workspace = await client.workspaces.create({
    name: projectName,
    clone: repoUrl
  })

  console.log(`Created workspace: ${workspace.name}`)

  // Wait for ready
  let status = await client.workspaces.get({ name: projectName })
  while (status.status === 'creating') {
    await new Promise(resolve => setTimeout(resolve, 1000))
    status = await client.workspaces.get({ name: projectName })
  }

  console.log(`Workspace ready! SSH: ${status.ports.ssh}`)
}

createDevEnvironment('myapp', 'git@github.com:user/myapp.git')
```

### Monitoring Script

```typescript
async function monitorWorkspaces() {
  const workspaces = await client.workspaces.list()

  for (const ws of workspaces) {
    const details = await client.workspaces.get({ name: ws.name })
    console.log(`${ws.name}: ${ws.status}`)

    if (ws.status === 'error') {
      const logs = await client.workspaces.logs({ name: ws.name, tail: 50 })
      console.error(`Error logs:\n${logs}`)
    }
  }
}

setInterval(monitorWorkspaces, 60000) // Every minute
```

## Next Steps

- [Workspaces Endpoint](./endpoints/workspaces.md)
- [Sessions Endpoint](./endpoints/sessions.md)
- [Config Endpoint](./endpoints/config.md)
- [Terminal WebSocket](./endpoints/terminal.md)
- [Type Definitions](./types.md)
