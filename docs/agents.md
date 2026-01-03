# Coding Agents

Workspaces come pre-installed with AI coding assistants. Configure credentials to enable them.

## Available Agents

### Claude Code

Interactive AI assistant from Anthropic with terminal-based interface.

**Configuration:**

1. Generate an OAuth token locally:
   ```bash
   claude setup-token
   ```
2. Copy the token
3. In Settings > Agents, paste into "OAuth Token" field
4. Save

The token is injected as `CLAUDE_CODE_OAUTH_TOKEN` in workspaces.

### OpenCode

AI coding assistant using OpenAI-compatible APIs.

**Configuration:**

1. Get an API key from OpenAI or a compatible provider
2. In Settings > Agents:
   - Paste API key into "API Key" field
   - Optionally set "Base URL" for non-OpenAI providers
3. Save

Environment variables:
- `OPENAI_API_KEY` - Your API key
- `OPENAI_BASE_URL` - API endpoint (optional)

### Codex CLI

OpenAI's command-line coding tool. Uses the same credentials as OpenCode.

**Note:** ChatGPT Plus subscriptions do not include API access. You need API credits from the OpenAI Platform.

### GitHub

Personal Access Token for Git operations.

**Configuration:**

1. Create a token at https://github.com/settings/personal-access-tokens/new
2. Select required permissions:
   - Repository access for your projects
   - "Copilot Requests" for GitHub Copilot CLI
3. In Settings > Agents, paste token into "Token" field
4. Save

Injected as `GITHUB_TOKEN` in workspaces.

## Using Agents in Workspaces

Once configured, agents are available in all workspaces. Start them from the terminal:

```bash
# Claude Code
claude

# OpenCode
opencode

# Codex CLI
codex

# GitHub Copilot (requires gh auth)
gh copilot suggest "..."
```

## Viewing Agent Sessions

The Sessions page shows conversation history from AI agents:

1. Select a workspace from the dropdown
2. View past sessions grouped by agent type
3. Click a session to see the full message history

Sessions are stored in `~/.claude` (Claude Code) or equivalent directories inside workspaces.

## Troubleshooting

### "Token not valid" errors

- Regenerate the token using `claude setup-token`
- Ensure the token is complete (no truncation when pasting)

### API rate limits

- Check your API usage on provider dashboards
- Consider using a different model or provider

### GitHub authentication failures

- Verify token permissions include repo access
- Check token hasn't expired
- Try `gh auth login` inside the workspace for interactive setup
