# Workspace Implementation Tasks

> **Workflow**:
>
> - **Completed tasks are removed** from this list entirely
> - **New task ideas go to Considerations** section first for discussion
> - **Tasks listed below are confirmed work** that must be performed
>
> **Research Tasks**:
>
> - Research tasks are always allowed and should be performed when listed
> - Document findings in `docs/research/RESEARCH_<TOPIC>.md` files
> - Convert research into concrete implementation tasks when complete

---

## Tasks

### Binary Distribution via Curl Install Script

Switch from npm-based distribution to standalone binary distribution with curl install script (like OpenCode/Claude Code).

**Benefits:**
- No runtime dependency (currently requires Bun installed globally)
- Single binary, faster cold starts with bytecode compilation
- Simpler: `curl -fsSL https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash`

#### Phase 1: Binary Build System

- [ ] Create binary build script using Bun's `--compile` flag for all platforms:
  - `perry-linux-x64` (glibc)
  - `perry-linux-arm64` (glibc)
  - `perry-darwin-x64` (Intel Mac)
  - `perry-darwin-arm64` (Apple Silicon)
  - `perry-windows-x64.exe`
- [ ] Use `--minify --bytecode` flags for optimized binaries
- [ ] Handle web UI assets embedding (investigate Bun file embedding)
- [ ] Add `build:binaries` script to package.json
- [ ] Test compiled binary runs basic commands locally

#### Phase 2: Install Script

- [ ] Create `install.sh` at repository root with:
  - Platform detection (Darwin/Linux via uname)
  - Architecture detection (x64/arm64)
  - GitHub releases API to fetch latest version
  - Download binary from GitHub releases
  - Install to `$HOME/.perry/bin` (or `$PERRY_INSTALL_DIR`)
  - PATH modification (.bashrc, .zshrc, config.fish, .profile)
  - Post-install verification (`perry --version`)
- [ ] Support `--version` flag for specific version install
- [ ] Support `--no-modify-path` flag
- [ ] GitHub Actions detection (add to `$GITHUB_PATH`)

#### Phase 3: Release Workflow

- [ ] Add `binaries` job to `.github/workflows/release.yml`:
  - Cross-compile for all targets using Bun
  - Create archives (tar.gz for Linux/macOS, zip for Windows)
  - Upload to GitHub Releases
  - Generate SHA256 checksums
- [ ] Keep npm publish as alternative install method

#### Phase 4: Update Checker

- [ ] Modify `src/update-checker.ts`:
  - Query GitHub releases API instead of npm registry
  - Update upgrade message to show curl command
- [ ] (Optional) Add `perry upgrade` self-update command

#### Phase 5: Documentation

- [ ] Update `docs/docs/installation.md` with curl install as primary method
- [ ] Update README.md
- [ ] Document manual download from GitHub Releases
- [ ] Document uninstall process

---

## Considerations

> Add items here to discuss with project owner before promoting to tasks.

### OpenCode Server API Integration

Research completed - see [RESEARCH_AGENT_TERMINAL.md](./docs/research/RESEARCH_AGENT_TERMINAL.md)

Current approach uses `opencode run --format json` per message. OpenCode has `opencode serve` with HTTP API and SSE streaming that would be more efficient.

**Challenges:**
- OpenCode server runs inside container, Perry agent on host
- Requires either port exposure or docker exec tunneling
- Port exposure needs container/Dockerfile changes
- Docker exec approach doesn't provide significant benefits

**Prerequisites for implementation:**
- Decide on port exposure strategy (add internal port or use SSH tunneling)
- Determine process lifecycle management (on-demand vs always-on)
- @opencode-ai/sdk available for TypeScript client

**Recommendation:** Lower priority given working CLI approach with session history loading. Consider when container port exposure strategy is decided.

### Design Document Updates (Pending Review)

- **Port range discrepancy**: Design says "starts at 4200" but implementation uses 2200-2400
- **SSE streaming not implemented**: Design specifies SSE for log streaming (`?follow=true`) but implementation uses simple request/response
- **Config API is writable**: Design says read-only but implementation allows updates via API (this is better, just document it)

### Token Usage Tracking

Research document: [docs/research/RESEARCH_TOKEN_USAGE.md](./docs/research/RESEARCH_TOKEN_USAGE.md)

Track API token usage across workspaces to monitor costs. Approaches researched:

- Log-based collection from workspaces
- SQLite storage on agent
- Per-agent and per-workspace breakdown
- Cost estimation based on model pricing

### Mock Claude API in Chat Tests

Consider adding MSW (Mock Service Worker) or similar to mock Claude API responses in chat integration tests. This would:
- Avoid requiring real API keys in CI
- Make tests faster and more reliable
- Allow testing of specific response scenarios
