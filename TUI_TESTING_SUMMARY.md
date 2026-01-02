# TUI Testing Research Summary

## Overview

This research investigated how to test terminal user interfaces (TUIs) in Node.js applications, specifically for your Workspace CLI project. The goal was to provide practical, minimal-complexity recommendations for testing CLI applications with interactive output.

## Key Findings

### 1. Current State of Your Project

Your project is already well-positioned for CLI testing:
- ✅ Vitest configured correctly with process isolation (`singleFork: true`)
- ✅ Integration tests demonstrating spawned process testing
- ✅ Test helpers infrastructure in place
- ✅ No TUI library yet (you have `@opentui/core` dependency but it's not actively used)
- ✅ Simple command-line interface with no prompts currently

### 2. Most Common TUI Testing Approaches

The industry uses **three main patterns**:

| Approach | Complexity | Speed | Use Case |
|----------|-----------|-------|----------|
| **Spawn + Capture Output** | Low | Medium | Most CLI testing |
| **Mock stdin/stdout** | Low | Fast | Unit testing output logic |
| **Component Testing** (Ink) | Medium | Fast | React-based TUIs |
| **PTY (Pseudo-Terminal)** | High | Slow | Terminal-specific features |
| **tmux** | Medium | Slow | Manual debugging only |

**Recommendation**: Start with spawn + capture output (already used in your project). Add mock-stdin only if you add interactive prompts.

### 3. What About tmux?

**Verdict: Not recommended for automated testing**

tmux is excellent for:
- Manual debugging of CLI behavior
- Running multiple processes in development
- Deploying/managing services

But poor for automated testing because:
- Slow and unreliable
- Requires external installation
- Difficult to assert on output
- Timing issues with automation

Better alternatives exist (`node-pty` for full terminal emulation, spawn for simple testing).

### 4. TUI Libraries in Node.js

#### Blessed (High-level Terminal Library)
- Used for complex terminal UIs
- Typically tested with manual test programs (bounce.py, editor.py, etc.)
- Component testing not formalized in the library

#### Ink (React for CLIs)
- **Recommended if** you adopt Ink for interactive UIs
- Provides `ink-testing-library` for component testing
- Fast, unit-test style assertions
- Used by Gatsby, Parcel, Yarn

#### oclif (Enterprise CLI Framework)
- Provides `@oclif/test` utilities
- Handles command-line argument parsing
- Good for structured CLI testing

#### Commander.js (Your Framework)
- Minimal testing framework provided
- Best tested with spawn + argument passing
- Works well for your use case

### 5. Node.js-Specific Testing Tools

**Key Libraries:**
- **mock-stdin** - Simulate keyboard input in tests
- **node-pty** (Microsoft) - Full pseudo-terminal emulation
- **ink-testing-library** - Component testing for Ink
- **mock-cli** - Bridge between mocking and spawning

**Verdict for Your Project**:
- Don't need PTY
- Don't need mocks unless testing unit logic
- mock-stdin is optional (only if adding interactive prompts)
- Simple spawn approach is sufficient

## Practical Recommendation for Your Project

### Tier 1: Simple Output Testing (Use Immediately)

```typescript
import { runCLI, stripANSI } from '../helpers/cli-runner';

it('lists workspaces', async () => {
  const { stdout, code } = await runCLI(['list']);
  expect(code).toBe(0);
  expect(stripANSI(stdout)).toContain('workspace');
});
```

**No dependencies needed.** Already works with what you have.

### Tier 2: Interactive Testing (Use When Needed)

```typescript
import { runPromptCLI, TERMINAL_KEYS } from '../helpers/interactive-cli-runner';

it('creates workspace interactively', async () => {
  const { stdout, code } = await runPromptCLI(
    ['create', '--interactive'],
    ['my-workspace', 'docker']
  );
  expect(code).toBe(0);
});
```

**Requires:** `npm install --save-dev mock-stdin` (only if you add interactive prompts)

### Tier 3: Full E2E Testing (Already Doing)

Your e2e tests in `test/e2e/workspace.test.ts` are solid. Keep using that pattern.

## Deliverables Created

### 1. Research Documents

- **TUI_TESTING_RESEARCH.md** (12 sections)
  - Comprehensive research on all TUI testing approaches
  - Detailed comparison of tools and techniques
  - Recommended next steps specific to your project

- **TUI_TESTING_EXAMPLES.md** (9 sections)
  - Copy-paste ready test examples
  - Patterns for output testing, input simulation, error handling
  - Troubleshooting guide

### 2. Ready-to-Use Helpers

- **test/helpers/cli-runner.ts** (115 lines)
  - Functions: `runCLI()`, `stripANSI()`, `hasText()`, `runCLIExpecting()`, `runCLIExpectingError()`
  - No external dependencies
  - TypeScript types included
  - Handles timeout, environment variables, exit codes

- **test/helpers/interactive-cli-runner.ts** (165 lines)
  - Functions: `runInteractiveCLI()`, `runPromptCLI()`, `runMenuCLI()`
  - Constants: `TERMINAL_KEYS` object with all special keys
  - Helper functions: `withEnter()`, `extractLines()`, `findLine()`
  - Requires `mock-stdin` (optional)

### 3. Quick Start Guide

- **TESTING_QUICK_START.md** (Quick reference)
  - One-page quick reference for common patterns
  - Installation instructions
  - When to use what
  - Troubleshooting tips

## What You Can Do Right Now

### Option 1: Use Existing Helpers (No Dependencies)

The `cli-runner.ts` helper is ready to use. No extra installation needed:

```bash
# Create a test file
cat > test/cli/basic.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { runCLI, stripANSI } from '../helpers/cli-runner';

describe('CLI', () => {
  it('displays help', async () => {
    const { stdout, code } = await runCLI(['--help']);
    expect(code).toBe(0);
    expect(stripANSI(stdout)).toContain('workspace');
  });
});
EOF

# Run it
npm test test/cli/basic.test.ts
```

### Option 2: Add Interactive Testing When Needed

Only when you have prompts/interactive features:

```bash
npm install --save-dev mock-stdin
npm test test/cli/interactive.test.ts
```

## What NOT to Do

- ❌ Don't use tmux for automated testing
- ❌ Don't add PTY (node-pty) unless you test terminal-specific features
- ❌ Don't over-engineer with mocking frameworks
- ❌ Don't mock stdin unless testing unit logic
- ❌ Don't add complex TUI libraries unless needed

## Why This Matters

Your project runs in Docker containers with SSH access. Testing the actual CLI (not just Docker operations) is important for:
1. **Argument parsing** - Ensure commands accept correct arguments
2. **Error messages** - Verify helpful errors on invalid input
3. **Output formatting** - Confirm readable output
4. **Exit codes** - Check success/failure codes
5. **Integration** - Verify CLI works end-to-end before containers

## Next Steps

1. **Review the documents**
   - Read `TESTING_QUICK_START.md` (5 min)
   - Skim `TUI_TESTING_RESEARCH.md` for context
   - Reference `TUI_TESTING_EXAMPLES.md` when writing tests

2. **Use the helpers**
   - They're already in `test/helpers/`
   - Import and use in your test files
   - No configuration needed

3. **Write a test**
   - Start with `runCLI(['list'])` test
   - Add more output tests
   - Add error tests

4. **Optional: Add interactive tests**
   - Only if you add prompts to your CLI
   - Follow examples in `TESTING_QUICK_START.md`
   - Install `mock-stdin` at that time

## Summary Table

| Question | Answer |
|----------|--------|
| How test TUI output? | Spawn CLI, capture stdout, assert text |
| Is tmux good? | No, only for manual debugging |
| Which Node library? | No library needed yet (using Commander.js) |
| Need PTY? | No, simple spawn is enough |
| Need mock-stdin? | Only if adding interactive prompts |
| Complexity? | Very low - already using this pattern |
| Can start now? | Yes, helpers are ready |

---

## Document Reference

**You now have:**
1. ✅ TUI_TESTING_RESEARCH.md - 10 sections of research
2. ✅ TUI_TESTING_EXAMPLES.md - 9 sections of copy-paste examples
3. ✅ TESTING_QUICK_START.md - One-page quick reference
4. ✅ test/helpers/cli-runner.ts - Ready to import and use
5. ✅ test/helpers/interactive-cli-runner.ts - For interactive testing
6. ✅ TUI_TESTING_SUMMARY.md - This document

Start with #3, reference #2 when writing tests, use helpers from #4 and #5.

---

## Additional Resources

The research includes links to:
- [GitHub - microsoft/node-pty](https://github.com/microsoft/node-pty)
- [GitHub - chjj/blessed](https://github.com/chjj/blessed)
- [GitHub - vadimdemedes/ink](https://github.com/vadimdemedes/ink)
- [oclif Testing Documentation](https://oclif.io/docs/testing/)
- [Unit Testing Node CLI with Jest](https://medium.com/@altshort/unit-testing-node-cli-apps-with-jest-2cd4adc599fb)
- [CLI Integration Testing Part 1 & 2](https://medium.com/@zorrodg/integration-tests-on-node-js-cli-part-1-why-and-how-fa5b1ba552fe)
- [Smashing Magazine: Testing The CLI The Way People Use It](https://www.smashingmagazine.com/2022/04/testing-cli-way-people-use-it/)

See TUI_TESTING_RESEARCH.md for complete source list.
