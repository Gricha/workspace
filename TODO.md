# Workspace Implementation Tasks

> **Important**: Remove tasks from this list when completed. Do not add new tasks without discussing with the project owner first - add them to "Considerations" section instead.

## Testing

(Completed)

## Phase 5: TUI

- [ ] Implement TUI dashboard that launches when running `workspace` with no arguments
  - OpenTUI-based interactive terminal UI
  - Workspace list view with status indicators
  - Create/start/stop/delete workspace actions
  - Integrated terminal (select workspace, open shell)
  - Settings/config management view
- [ ] First-run UX: prompt user for worker hostname if not configured
  - When running any command without worker set, interactively ask for hostname
  - Save to client config after successful connection test
  - Example: `? No worker configured. Enter worker hostname: my-desktop.tail1234.ts.net`

## Phase 6: Web UI

(Completed)

## Phase 7: Polish (Future)

- [ ] Comprehensive error messages with actionable fixes
- [ ] User documentation
- [ ] Docker image publishing to registry
- [ ] `ws agent logs` command for debugging

---

## Research Tasks

- [ ] Research Codex CLI authentication method and portability
- [ ] Research GitHub Copilot token portability (lower priority)

---

## Considerations

> Add items here to discuss with project owner before promoting to tasks.

- Change oxlint warnings to errors (currently 9 warnings in pre-existing code: unused imports, unused variables, empty catch blocks)
