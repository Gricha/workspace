---
sidebar_position: 6
---

# AI Agents

Perry workspaces come with AI coding assistants pre-installed.

## Claude Code

[Claude Code](https://claude.ai/code) is Anthropic's AI coding assistant.

### Setup

1. On your host machine, run:
   ```bash
   claude setup-token
   ```
   This generates an OAuth token for container use.

2. Add the token to Perry:

   **Via config.json:**
   ```json
   {
     "agents": {
       "claude_code": {
         "oauth_token": "sk-ant-oat01-..."
       }
     }
   }
   ```

   **Via Web UI:**
   - Settings > Agents > Claude Code OAuth Token

3. Restart workspaces to apply:
   ```bash
   perry stop myproject
   perry start myproject
   ```

### Usage

Inside a workspace:

```bash
claude
```

### Alternative: Credentials File

Perry also copies `~/.claude/.credentials.json` if it exists on your host. This provides authentication without the explicit OAuth token.

## OpenCode

[OpenCode](https://github.com/sst/opencode) is an open-source AI coding assistant.

### Setup

1. Get a Zen token from OpenCode

2. Add to Perry:

   **Via config.json:**
   ```json
   {
     "agents": {
       "opencode": {
         "zen_token": "your-zen-token",
         "server": {
           "hostname": "0.0.0.0",
           "username": "opencode",
           "password": "your-password"
         }
       }
     }
   }
   ```

   Notes:
   - `server.hostname` controls what Perry passes to `opencode serve --hostname` inside workspaces.
   - Default is `0.0.0.0` to allow connecting over Tailscale.
   - Set `server.hostname` to `127.0.0.1` if you want local-only.
   - `server.password` is optional but strongly recommended when binding `0.0.0.0`.

   **Via Web UI:**
   - Settings > Agents > OpenCode Zen Token

### Usage

Inside a workspace:

```bash
opencode
```

### Alternative: OpenAI API Key

You can also use OpenCode with an OpenAI API key:

```json
{
  "credentials": {
    "env": {
      "OPENAI_API_KEY": "sk-..."
    }
  }
}
```

## Codex CLI

[Codex CLI](https://github.com/openai/codex-cli) is OpenAI's coding assistant.

### Setup

Perry copies `~/.codex/` directory from your host if it exists, including:
- `auth.json` - Authentication
- `config.toml` - Configuration

### Usage

Inside a workspace:

```bash
codex
```

## GitHub Copilot

GitHub Copilot is available through the GitHub CLI.

### Setup

1. Configure GitHub token (see [GitHub Integration](./github.md))
2. Authenticate inside workspace:
   ```bash
   gh auth login
   gh extension install github/gh-copilot
   ```

### Usage

```bash
gh copilot suggest "create a REST API endpoint"
gh copilot explain "what does this code do"
```

## Viewing Sessions

Perry tracks AI agent sessions in the Web UI:

1. Open http://localhost:7391
2. Click on a workspace
3. View "Sessions" or "Chat" tab

Sessions show conversation history from Claude Code, OpenCode, and Codex.

## Environment Variables

All AI agent credentials are injected as environment variables:

| Agent | Variable |
|-------|----------|
| Claude Code | `CLAUDE_CODE_OAUTH_TOKEN` |
| GitHub | `GITHUB_TOKEN` |
| OpenAI/OpenCode | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |

You can also set these directly in environment config:

```json
{
  "credentials": {
    "env": {
      "ANTHROPIC_API_KEY": "sk-ant-...",
      "OPENAI_API_KEY": "sk-..."
    }
  }
}
```
