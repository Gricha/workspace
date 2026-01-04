---
sidebar_position: 1
---

# AI Coding Agents

Workspaces come pre-installed with AI coding assistants. Configure credentials once in the agent, and they're available in all workspaces.

## Available Agents

Workspace includes these AI assistants:

| Agent | Description | Provider |
|-------|-------------|----------|
| **Claude Code** | Terminal-based AI assistant with agentic capabilities | Anthropic |
| **OpenCode** | AI coding assistant using OpenAI-compatible APIs | OpenAI / Compatible |
| **Codex CLI** | OpenAI's command-line coding tool | OpenAI |
| **GitHub Copilot** | AI pair programmer (via GitHub CLI) | GitHub/OpenAI |

All agents are pre-installed in the workspace image. You only need to configure credentials.

## Quick Setup

### 1. Configure Credentials

Go to Settings > Agents in the Web UI and add your credentials:

- **Claude Code**: OAuth token from `claude setup-token`
- **OpenCode**: OpenAI API key
- **GitHub**: Personal access token

### 2. Restart Workspaces

Stop and start workspaces to apply credentials:

```bash
ws stop myproject
ws start myproject
```

### 3. Use Inside Workspaces

SSH into any workspace:

```bash
ssh -p 2201 workspace@localhost
```

Start an AI agent:

```bash
claude         # Claude Code
opencode       # OpenCode
codex          # Codex CLI
gh copilot suggest "..."  # GitHub Copilot
```

## Claude Code

Interactive AI assistant from Anthropic with agentic capabilities.

### Features

- Terminal-based chat interface
- File creation and editing
- Command execution with approval
- Context from workspace files
- Multi-turn conversations

### Configuration

**Method 1: OAuth Token (Recommended)**

1. On your host machine (not in workspace):
   ```bash
   claude setup-token
   ```

2. Copy the generated token

3. In Web UI → Settings → Agents:
   - Paste token into "Claude Code OAuth Token" field
   - Save

4. Restart workspaces

**Method 2: Credentials File (Linux only)**

1. Copy credentials directory:
   ```yaml
   # In config.yaml
   credentials:
     files:
       ~/.claude/.credentials.json: ~/.claude/.credentials.json
   ```

### Usage

```bash
claude

# Inside Claude Code:
> Can you help me refactor this function?
> Create a new API endpoint for user registration
> Fix the bug in src/auth.ts
```

### Environment Variable

Claude Code checks for:

```bash
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
```

This is automatically set from your agent configuration.

## OpenCode

AI coding assistant using OpenAI-compatible APIs.

### Features

- Code generation
- Refactoring assistance
- Bug fixing
- Documentation generation
- Supports OpenAI and compatible providers

### Configuration

1. Get an API key:
   - **OpenAI**: https://platform.openai.com/api-keys
   - **Compatible providers**: Groq, Together AI, etc.

2. In Web UI → Settings → Agents:
   - Paste API key into "OpenCode API Key" field
   - Optionally set "Base URL" for non-OpenAI providers
   - Save

3. Restart workspaces

### Usage

```bash
opencode

# Inside OpenCode:
> Generate a REST API handler for creating users
> Explain this complex function
> Add error handling to this code
```

### Environment Variables

```bash
OPENAI_API_KEY=sk-...           # API key (required)
OPENAI_BASE_URL=https://...     # API endpoint (optional)
```

### Non-OpenAI Providers

Configure alternative providers:

```yaml
# config.yaml
credentials:
  env:
    OPENAI_API_KEY: "your-key"
    OPENAI_BASE_URL: "https://api.groq.com/openai/v1"
```

## Codex CLI

OpenAI's command-line coding tool.

### Features

- Natural language to code
- Code explanations
- Shell command suggestions

### Configuration

Uses the same credentials as OpenCode:

```yaml
credentials:
  env:
    OPENAI_API_KEY: "sk-..."
```

### Usage

```bash
codex "create a function to calculate fibonacci"
codex explain "what does this regex do: /^[a-z0-9]+$/i"
```

:::warning
ChatGPT Plus subscriptions do NOT include API access. You need separate API credits from the OpenAI Platform.
:::

## GitHub Copilot

AI pair programmer accessible via GitHub CLI.

### Features

- Code suggestions
- Command-line help
- Integration with GitHub

### Configuration

1. Create a Personal Access Token:
   - Go to https://github.com/settings/personal-access-tokens/new
   - Select required scopes:
     - Repository access for your projects
     - "Copilot Requests" permission
   - Generate token

2. In Web UI → Settings → Agents:
   - Paste token into "GitHub Token" field
   - Save

3. Restart workspaces

### Usage

```bash
# Get command suggestions
gh copilot suggest "how to list all git branches"

# Explain commands
gh copilot explain "kubectl get pods --all-namespaces"
```

### Alternative: Interactive Login

Inside a workspace:

```bash
gh auth login
# Follow prompts to authenticate
```

## Viewing Agent Sessions

The Web UI Sessions page shows conversation history from AI agents.

### Accessing Sessions

1. Open Web UI → Sessions
2. Select a workspace from dropdown
3. View past sessions grouped by agent type
4. Click a session to see full message history

### Session Storage

Sessions are stored inside workspaces:

- **Claude Code**: `~/.claude/sessions/`
- **OpenCode**: `~/.opencode/sessions/`
- **Codex**: `~/.codex/sessions/`

### Session Formats

Different agents store sessions in different formats:

- Claude Code: JSON with tool use tracking
- OpenCode: Markdown or JSON
- Codex: Plain text

The Web UI parses all formats and displays them consistently.

## Troubleshooting

### "Token not valid" errors

**Cause**: OAuth token expired or incorrectly copied.

**Solutions**:
1. Regenerate token: `claude setup-token`
2. Ensure full token copied (no truncation)
3. Restart workspace

### API rate limits

**Cause**: Too many requests to AI service.

**Solutions**:
1. Check usage on provider dashboard
2. Wait for rate limit reset
3. Consider upgrading API plan

### GitHub authentication failures

**Cause**: Token missing permissions or expired.

**Solutions**:
1. Regenerate token with correct scopes
2. Check token hasn't expired
3. Try interactive login: `gh auth login`

### Sessions not appearing

**Cause**: No sessions exist or parser error.

**Solutions**:
1. Ensure workspace is running
2. Create a session by using an agent
3. Refresh the Sessions page

## Best Practices

### API Key Management

- **Separate keys per environment** (dev, staging, prod)
- **Rotate keys regularly**
- **Monitor usage** via provider dashboards
- **Set spending limits** to avoid surprise bills

### Cost Optimization

- **Use appropriate models**: Smaller/faster models for simple tasks
- **Limit context size**: Don't send entire large files
- **Cache responses**: Reuse previous answers when possible
- **Monitor usage**: Check Sessions page for activity

### Security

- **Never commit API keys** to version control
- **Use read-only tokens** when possible
- **Restrict token scopes** to minimum needed
- **Revoke tokens** if compromised

### Workflow Integration

1. **Start with Claude Code** for complex tasks requiring file editing
2. **Use OpenCode** for quick code generation
3. **Use GitHub Copilot** for command-line assistance
4. **Review all AI-generated code** before committing

## Comparison

| Feature | Claude Code | OpenCode | GitHub Copilot |
|---------|-------------|----------|----------------|
| **File Editing** | ✅ Direct | ❌ Copy/paste | ❌ Manual |
| **Command Execution** | ✅ With approval | ❌ No | ❌ No |
| **Multi-file Context** | ✅ Yes | ✅ Yes | ⚠️ Limited |
| **Cost** | Pay per use | Pay per use | Included with Copilot |
| **Provider** | Anthropic | OpenAI / Compatible | GitHub/OpenAI |
| **Best For** | Complex tasks | Code generation | CLI help |

## Next Steps

- [Configure Claude Code](./claude-code.md)
- [Configure OpenCode](./opencode.md)
- [Set Up GitHub Integration](./github.md)
- [View Agent Sessions](./sessions.md)
