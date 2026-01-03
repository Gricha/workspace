# UI Redesign and Coding Agent Integration Plan

## Overview

Transform the workspace web UI from a simple navbar layout into a professional side-panel navigation system with comprehensive settings for coding agents (Claude Code, Codex, OpenCode).

---

## Part 1: UI Redesign

### Current State
- Top navbar with links to pages
- Settings page with simple form for env vars, files, and post-start script
- No organized categories

### Target State
- **Left side-panel navigation** (collapsible)
- **Main content area** on the right
- **Two main sections**: Workspaces and Settings
- Settings subdivided into categories

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ [≡]  Workspace Manager                              [User] │
├────────────────┬────────────────────────────────────────────┤
│                │                                            │
│  WORKSPACES    │         Main Content Area                  │
│   ● alpha      │                                            │
│   ○ beta       │                                            │
│   + New        │                                            │
│                │                                            │
│  ─────────────│                                            │
│                │                                            │
│  SETTINGS      │                                            │
│   Environment  │                                            │
│   Coding Agents│                                            │
│   GitHub       │                                            │
│   Files        │                                            │
│   Scripts      │                                            │
│                │                                            │
└────────────────┴────────────────────────────────────────────┘
```

### Navigation Hierarchy

```
├── Workspaces (default view)
│   └── List of workspaces with quick actions
│
├── Settings
│   ├── Environment Variables
│   │   └── Key-value pairs for env vars
│   │
│   ├── Coding Agents
│   │   ├── Claude Code (OAuth flow)
│   │   ├── Codex CLI (OAuth flow)
│   │   └── OpenCode (API key)
│   │
│   ├── GitHub
│   │   └── Personal Access Token
│   │
│   ├── Credential Files
│   │   └── SSH keys, gitconfig, etc.
│   │
│   └── Scripts
│       └── Post-start script path
```

### UI Tasks

1. **Create side-panel layout component**
   - Collapsible sidebar (hamburger menu on mobile)
   - Persistent navigation state
   - Active item highlighting

2. **Refactor navigation**
   - Remove top navbar
   - Add sidebar navigation
   - Add section headers

3. **Create settings sub-routes**
   - `/settings/environment`
   - `/settings/agents`
   - `/settings/github`
   - `/settings/files`
   - `/settings/scripts`

4. **Update workspace list**
   - Show in sidebar with status indicators
   - Click to view details in main area
   - Quick actions (start/stop/delete)

---

## Part 2: Coding Agents Integration

### Overview

Allow users to authenticate with coding agents once, then automatically inject credentials into all new workspaces.

### Agent Matrix

| Agent | Auth Method | Token Storage | Injection Method |
|-------|-------------|---------------|------------------|
| Claude Code | OAuth | `CLAUDE_CODE_OAUTH_TOKEN` | env var |
| Codex CLI | OAuth (TBD) | env var or file | TBD |
| OpenCode | API Key | `OPENAI_API_KEY` | env var |

---

### A. Claude Code Integration

#### Background (from DESIGN.md)
- Claude Code supports `CLAUDE_CODE_OAUTH_TOKEN` env var (designed for containers/CI)
- User can run `claude setup-token` to generate long-lived token
- Alternative: Copy `~/.claude/.credentials.json` (Linux only)

#### Flow Option 1: Manual Token Entry
```
User Experience:
1. User opens Settings > Coding Agents > Claude Code
2. Sees instructions: "Run `claude setup-token` in your terminal"
3. User pastes the generated token
4. Token is saved to config
5. Token is injected as env var into all new workspaces
```

#### Flow Option 2: OAuth in Browser (Preferred)
```
User Experience:
1. User opens Settings > Coding Agents > Claude Code
2. Clicks "Connect with Claude"
3. Browser opens Anthropic OAuth flow
4. User authorizes
5. Redirect back with token
6. Token is saved to config
7. Token is injected as env var into all new workspaces
```

#### Implementation Tasks

1. **Research Claude OAuth flow**
   - Document OAuth endpoints
   - Required scopes
   - Token format and refresh strategy

2. **Backend: OAuth callback endpoint**
   - `GET /auth/claude/callback`
   - Exchange code for token
   - Store token in config

3. **Backend: Token storage**
   - Extend config schema for agent tokens
   - Secure storage (same as other credentials)

4. **Frontend: Claude Code settings card**
   - Connection status (connected/not connected)
   - Connect button (triggers OAuth)
   - Disconnect button
   - Token info (masked, expiry if available)

5. **Workspace creation: Token injection**
   - Check for Claude token in config
   - Add to container env vars

---

### B. Codex CLI Integration

#### Research Needed
- How does Codex CLI authenticate?
- Where are tokens stored?
- Is there an OAuth flow or just API key?
- Portability for containers?

#### Likely Implementation
Based on similar tools, Codex probably:
- Uses OpenAI-style API key, OR
- Has OAuth flow similar to Claude Code

#### Tasks

1. **Research Codex authentication**
   - Install and test Codex CLI
   - Document auth mechanism
   - Find token/credential location

2. **Implement based on research**
   - If OAuth: Similar to Claude Code
   - If API key: Simple text input (like OpenCode)

---

### C. OpenCode Integration

#### Background
- OpenCode uses OpenAI API
- Just needs `OPENAI_API_KEY` environment variable
- Simplest case - no OAuth needed

#### Flow
```
User Experience:
1. User opens Settings > Coding Agents > OpenCode
2. Enters their OpenAI API key
3. Key is saved to config
4. Key is injected as OPENAI_API_KEY into all new workspaces
```

#### Implementation Tasks

1. **Frontend: OpenCode settings card**
   - API key input (password field)
   - Save button
   - Status indicator (configured/not configured)
   - Optional: Test button (validate key)

2. **Backend: Store key**
   - Already supported via credentials.env
   - Just UI for managing it

---

### D. GitHub Integration

#### Background
- GitHub Personal Access Token (PAT) for git operations
- Already supported as `GITHUB_TOKEN` in credentials.env
- Could add OAuth for better UX

#### Flow Option 1: Manual Token Entry (MVP)
```
User Experience:
1. User opens Settings > GitHub
2. Enters their GitHub PAT
3. Token is saved to config as GITHUB_TOKEN
4. Token is injected into all new workspaces
```

#### Flow Option 2: OAuth (Future Enhancement)
```
User Experience:
1. User opens Settings > GitHub
2. Clicks "Connect with GitHub"
3. Browser opens GitHub OAuth flow
4. User authorizes with selected scopes
5. Redirect back with token
6. Token is saved and refreshed automatically
```

#### Implementation Tasks

1. **Frontend: GitHub settings card**
   - Token input (password field)
   - Save button
   - Status indicator
   - Link to GitHub token creation page

2. **Future: GitHub OAuth**
   - Similar pattern to Claude Code
   - Research GitHub OAuth requirements

---

## Part 3: Backend API Changes

### New Config Schema

```typescript
interface AgentConfig {
  claude_code?: {
    oauth_token?: string
    connected_at?: string
    expires_at?: string  // if applicable
  }
  codex?: {
    // TBD based on research
    token?: string
    connected_at?: string
  }
  opencode?: {
    api_key?: string  // Same as OPENAI_API_KEY
  }
  github?: {
    token?: string  // Same as GITHUB_TOKEN
  }
}

// Existing credentials.env still works for manual overrides
```

### New API Endpoints

```typescript
// Agent management
GET  /rpc/agents                    // List all agent statuses
GET  /rpc/agents/:name              // Get specific agent status
POST /rpc/agents/:name/connect      // Initiate OAuth or save key
POST /rpc/agents/:name/disconnect   // Remove credentials

// OAuth callbacks (not oRPC - plain HTTP for OAuth redirects)
GET  /auth/claude/callback?code=... // Claude OAuth callback
GET  /auth/github/callback?code=... // GitHub OAuth callback
```

### Workspace Creation Changes

When creating workspace, inject all configured agent credentials:

```typescript
async function createWorkspace(name: string, options: CreateOptions) {
  const config = await loadConfig()
  const env: Record<string, string> = {
    ...config.credentials.env,
  }

  // Inject agent tokens
  if (config.agents?.claude_code?.oauth_token) {
    env.CLAUDE_CODE_OAUTH_TOKEN = config.agents.claude_code.oauth_token
  }
  if (config.agents?.opencode?.api_key) {
    env.OPENAI_API_KEY = config.agents.opencode.api_key
  }
  if (config.agents?.github?.token) {
    env.GITHUB_TOKEN = config.agents.github.token
  }
  // Codex TBD

  // Create container with env vars
  await docker.create({ env, ... })
}
```

---

## Part 4: Token Usage Tracking (Research Task)

### Objective
Track token usage across workspaces to help users monitor costs and usage patterns.

### Research Questions

1. **How to intercept/track API calls?**
   - Proxy approach (mitmproxy, transparent proxy)
   - SDK instrumentation
   - Log parsing

2. **What data to track?**
   - Request count
   - Token count (input/output)
   - Model used
   - Cost estimate
   - Timestamp
   - Workspace context

3. **Where to store data?**
   - SQLite in config dir
   - JSON file
   - External service

4. **How to display?**
   - Usage dashboard
   - Per-workspace breakdown
   - Time-series graphs
   - Cost alerts

5. **Privacy considerations?**
   - Don't log prompts/responses
   - Aggregate only
   - User opt-in

### Approach Options

**Option A: SDK-level instrumentation**
- Modify environment to wrap API calls
- Works for all tools using standard SDKs
- Requires understanding each tool's SDK

**Option B: Proxy-based**
- Run transparent proxy in container
- Intercept API calls to openai.com, api.anthropic.com
- Parse and log requests
- More invasive but comprehensive

**Option C: Log parsing**
- Parse tool logs for usage info
- Less intrusive
- May miss data

**Option D: External service**
- Use third-party usage tracking service
- Easier but external dependency

### Deliverable
Create `TOKEN_USAGE_TRACKING.md` with research findings and implementation recommendation.

---

## Implementation Phases

### Phase 1: UI Layout Redesign
- [ ] Create side-panel component
- [ ] Update routing structure
- [ ] Move workspace list to sidebar
- [ ] Create settings navigation
- [ ] Mobile responsive design

### Phase 2: Settings Categories
- [ ] Environment variables section (existing, move)
- [ ] Credential files section (existing, move)
- [ ] Scripts section (existing, move)
- [ ] Create empty Coding Agents section
- [ ] Create empty GitHub section

### Phase 3: OpenCode Integration (Simplest)
- [ ] OpenCode settings card UI
- [ ] Store OPENAI_API_KEY in config
- [ ] Inject into workspaces

### Phase 4: GitHub Integration
- [ ] GitHub settings card UI
- [ ] Store GITHUB_TOKEN in config
- [ ] Inject into workspaces
- [ ] Link to token creation

### Phase 5: Claude Code Integration
- [ ] Research Claude OAuth flow
- [ ] Implement OAuth backend
- [ ] Claude settings card UI
- [ ] Store and inject token

### Phase 6: Codex Integration
- [ ] Research Codex authentication
- [ ] Implement based on research
- [ ] Codex settings card UI

### Phase 7: Token Usage Research
- [ ] Research tracking approaches
- [ ] Create TOKEN_USAGE_TRACKING.md
- [ ] Update DESIGN.md with reference

---

## File Changes Required

### New Files
```
web/src/components/layout/Sidebar.tsx
web/src/components/layout/Layout.tsx
web/src/pages/settings/Environment.tsx
web/src/pages/settings/Agents.tsx
web/src/pages/settings/GitHub.tsx
web/src/pages/settings/Files.tsx
web/src/pages/settings/Scripts.tsx
web/src/components/agents/ClaudeCard.tsx
web/src/components/agents/CodexCard.tsx
web/src/components/agents/OpenCodeCard.tsx
web/src/components/agents/GitHubCard.tsx
src/agent/routes/auth.ts (OAuth callbacks)
docs/TOKEN_USAGE_TRACKING.md (research)
```

### Modified Files
```
web/src/App.tsx (update routing)
web/src/lib/api.ts (add agent endpoints)
src/config/schema.ts (add agents config)
src/agent/router.ts (add agent routes)
src/docker.ts (inject agent env vars)
DESIGN.md (add reference to token tracking doc)
```

---

## Dependencies

### UI Libraries (already have)
- React
- react-router
- shadcn/ui
- lucide-react

### New UI Components Needed
- Sidebar/Navigation component (shadcn has "sheet" for mobile)
- Card layouts for each agent
- Status indicators

### OAuth Libraries (if needed)
- Simple redirect-based OAuth (no library needed)
- JWT parsing if tokens are JWTs

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Claude OAuth not available | Fallback to manual token entry |
| Codex auth unknown | Research task, adapt implementation |
| Token storage security | Use same security as existing credentials |
| OAuth token expiry | Implement refresh flow if needed |
| Breaking existing settings | Migration path for existing config |

---

## Success Criteria

1. **UI Redesign**: Side-panel navigation works on desktop and mobile
2. **Settings Categories**: All settings organized under clear categories
3. **OpenCode**: Users can enter API key and it's injected into workspaces
4. **GitHub**: Users can enter PAT and it's injected into workspaces
5. **Claude Code**: Users can connect and token is injected into workspaces
6. **Codex**: Authentication researched and implemented (if feasible)
7. **Token Tracking**: Research document created with recommendation

---

## Questions for Review

1. Should we support multiple GitHub accounts/tokens?
2. Should agent credentials be per-workspace or global?
3. Should we show token usage in the UI (requires tracking implementation)?
4. Priority: Claude OAuth vs manual token entry for MVP?
5. Do we need to handle token refresh automatically?
