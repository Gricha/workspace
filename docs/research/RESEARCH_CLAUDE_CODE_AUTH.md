# Research: Claude Code Authentication Simplification

## Executive Summary

**Finding**: Claude Code CAN authenticate with just an OAuth token, but requires additional configuration.

**Solution**: Generate token via `claude setup-token`, set `CLAUDE_CODE_OAUTH_TOKEN` env var, AND create `~/.claude.json` with `hasCompletedOnboarding: true`.

---

## Authentication Methods

### 1. OAuth Token Only (Current Implementation Support)

We already support `oauth_token` field in Settings → Agents which injects `CLAUDE_CODE_OAUTH_TOKEN`.

**Problem**: Token alone triggers onboarding prompts. Need to also create config file.

### 2. Credentials Directory (Current)

Copy entire `~/.claude` directory including `.credentials.json`.

**Problem**: Awkward UX, requires user to find and specify path.

---

## Complete Headless Auth Solution

For OAuth token to work without prompts:

1. Set environment variable: `CLAUDE_CODE_OAUTH_TOKEN=<token>`
2. Create config file: `~/.claude.json` with `{"hasCompletedOnboarding": true}`

Both are required.

---

## Implementation Changes

### Current State

- `oauth_token` field exists in Settings → Agents
- Token is injected as `CLAUDE_CODE_OAUTH_TOKEN` env var
- `credentials_path` field copies `~/.claude` directory

### Required Changes

1. When `oauth_token` is provided, automatically create `~/.claude.json` in container with `hasCompletedOnboarding: true`
2. Update UI help text to explain token generation: "Run `claude setup-token` locally to generate"
3. Optional: Remove `credentials_path` field (superseded by token approach)

---

## Token Generation

Users generate tokens by running locally:

```bash
claude setup-token
```

This outputs a token that can be copied to Settings → Agents → Claude Code OAuth Token.

---

## Sources

- [Claude Code Issue #8938: setup-token not enough](https://github.com/anthropics/claude-code/issues/8938)
- [Claude Code Issue #7855: OAuth token interference](https://github.com/anthropics/claude-code/issues/7855)
- [Container Setup Guide](https://claude-did-this.com/claude-hub/getting-started/setup-container-guide)
- [Depot Claude Code Quickstart](https://depot.dev/docs/agents/claude-code/quickstart)
