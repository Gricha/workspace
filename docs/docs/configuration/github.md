---
sidebar_position: 4
---

# GitHub Integration

Configure GitHub access for cloning repositories and using GitHub CLI.

## Personal Access Token

### Create Token

1. Go to https://github.com/settings/personal-access-tokens/new
2. Give it a name (e.g., "Perry workspaces")
3. Set expiration
4. Select permissions:
   - **Contents**: Read and write (for cloning/pushing)
   - **Pull requests**: Read and write (optional, for PRs)
   - **Issues**: Read and write (optional)

### Configure Token

**Via config.json:**

```json
{
  "agents": {
    "github": {
      "token": "ghp_xxxxxxxxxxxxxxxxxxxx"
    }
  }
}
```

**Via Web UI:**

1. Open http://localhost:7391
2. Go to Settings > Agents
3. Enter token in "GitHub Token" field
4. Save

The token is automatically set as `GITHUB_TOKEN` environment variable in workspaces.

## SSH Keys

For SSH-based git operations (git@github.com:...), configure SSH keys.

### Via SSH Config

```bash
perry ssh copy ~/.ssh/id_ed25519
```

Or via config.json:

```json
{
  "ssh": {
    "global": {
      "copy": ["~/.ssh/id_ed25519"]
    }
  }
}
```

### Via Files Config (Legacy)

```json
{
  "credentials": {
    "files": {
      "~/.ssh/id_ed25519": "~/.ssh/id_ed25519",
      "~/.ssh/id_ed25519.pub": "~/.ssh/id_ed25519.pub"
    }
  }
}
```

### Test SSH Access

Inside a workspace:

```bash
ssh -T git@github.com
# Hi username! You've successfully authenticated
```

## Git Config

Copy your git configuration for consistent commits:

```json
{
  "credentials": {
    "files": {
      "~/.gitconfig": "~/.gitconfig"
    }
  }
}
```

Example `~/.gitconfig`:

```ini
[user]
    name = Your Name
    email = you@example.com
[init]
    defaultBranch = main
[pull]
    rebase = true
```

## GitHub CLI

The GitHub CLI (`gh`) is pre-installed in workspaces. With a token configured:

```bash
# Clone repos
gh repo clone owner/repo

# Create PRs
gh pr create

# View issues
gh issue list
```

## Cloning Private Repos

When creating workspaces with `--clone`:

```bash
# HTTPS (uses GITHUB_TOKEN)
perry start myproject --clone https://github.com/user/private-repo.git

# SSH (uses SSH key)
perry start myproject --clone git@github.com:user/private-repo.git
```

Both methods work if properly configured.
