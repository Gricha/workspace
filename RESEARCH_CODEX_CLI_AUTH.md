# Research: Codex CLI Authentication for ChatGPT Subscribers

## Executive Summary

**Finding**: Codex CLI supports ChatGPT subscription users through device code authentication. Credentials cached at `~/.codex/auth.json` are automatically copied to workspaces.

---

## Authentication Methods

### Device Code Authentication

ChatGPT subscribers can authenticate via:
1. Enable device code login in ChatGPT security settings
2. Run `codex login --device-auth` locally
3. Complete sign-in through browser link with one-time code

After authentication, credentials are cached at `~/.codex/auth.json`.

---

## Implementation

Credentials are automatically detected and copied from default locations:
- Claude Code: `~/.claude` → `/home/workspace/.claude`
- Codex CLI: `~/.codex` → `/home/workspace/.codex`

No user configuration required. If credentials exist locally, they are automatically injected into workspaces with appropriate permissions (600 for files, 700 for directories).

---

## Sources

- [Codex Authentication Docs](https://developers.openai.com/codex/auth)
- [GitHub Issue #3820: Headless Auth](https://github.com/openai/codex/issues/3820)
