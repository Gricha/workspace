---
sidebar_position: 4
---

# AI Agents

Pre-installed: Claude Code, OpenCode, GitHub Copilot.

## Claude Code

```bash
claude setup-token  # On host
```

Add token to Web UI → Settings → Agents → Claude Code.

## OpenCode

Add OpenAI API key to Web UI → Settings → Agents → OpenCode.

## GitHub

Create token at https://github.com/settings/personal-access-tokens/new

Add to Web UI → Settings → Agents → GitHub.

## Use

Inside workspace:
```bash
claude
opencode
gh copilot suggest "..."
```
