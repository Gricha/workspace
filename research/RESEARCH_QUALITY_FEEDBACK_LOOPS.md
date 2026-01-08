# Research Report: Quality & Feedback Loops for Agent Development

## Executive Summary

This report analyzes the Perry codebase from the perspective of quality assurance and feedback loops for agent-driven development. The core finding is that while the project has functional quality tooling, it's significantly under-configured and inconsistent across modules. The result: agents can introduce bugs that won't be caught until manual testing or production.

**Key metrics (updated):**
- Oxlint: All categories enabled (correctness, suspicious, pedantic, perf, style, restriction)
- Code coverage: Not measured
- Pre-commit hooks: Intentionally not used (see policy in section 2.4)
- Mobile linting: Enabled (included in global `bun run lint`)
- Web linting in CI: Enforced
- Type sync between API and clients: Manual/fragile

---

## Part 1: Duplication & Bifurcation Analysis

### 1.1 Type Definition Duplication (Critical)

The most significant duplication exists in type definitions across three locations:

| Type | src/shared/client-types.ts | web/src/lib/types.ts | mobile/src/lib/api.ts |
|------|---------------------------|----------------------|----------------------|
| WorkspaceInfo | ✓ L1-12 | ✓ L1-12 (copied) | ✓ L5-15 (rewritten) |
| SessionInfo | ✓ L64-72 | ✓ L64-72 (copied) | ✓ L69-77 (rewritten) |
| SessionMessage | ✓ L78-85 | ✓ L78-85 (copied) | ✓ L79-86 (rewritten) |
| CodingAgents | ✓ L42-54 | ✓ L42-54 (copied) | ✓ L47-59 (rewritten) |
| HostInfo | ✓ L95-100 | ✓ L95-100 (copied) | ✓ L24-29 (rewritten) |
| HOST_WORKSPACE_NAME | ✓ L93 | ✓ L93 (copied) | ✓ L31 (rewritten) |

**The current "solution"** (from `package.json` L16):
```bash
cp src/shared/client-types.ts web/src/lib/types.ts
```

This is a build-time copy, but:
- Mobile gets no automatic sync at all
- Any drift between `src/shared/client-types.ts` and `mobile/src/lib/api.ts` is invisible
- Web types lag behind until next build

**Evidence of drift already occurring:**

Web API (`web/src/lib/api.ts`) has:
- `sessions.rename` (L126-127)
- `sessions.clearName` (L128-129)
- `sessions.delete` (L130-131)
- `sessions.search` (L132-133)
- `workspaces.touch` (L118)

Mobile API (`mobile/src/lib/api.ts`) is **missing**:
- `sessions.rename`
- `sessions.clearName`
- `sessions.delete`
- `sessions.search`
- `workspaces.touch`
- `listAllSessions` endpoint

This is feature drift that won't be caught by any automated check.

### 1.2 Chat Handler Duplication (High)

`src/chat/handler.ts` and `src/chat/host-handler.ts` share nearly identical code:

| Method | handler.ts | host-handler.ts | Identical? |
|--------|-----------|-----------------|------------|
| StreamMessage interface | L18-40 | L11-33 | Yes |
| processBuffer() | L170-184 | L156-170 | Yes |
| handleStreamMessage() | L186-226 | L172-211 | ~95% |
| interrupt() | L228-238 | L213-223 | Yes |
| Default model | L56: `'sonnet'` | L46: `'sonnet'` | Yes (hardcoded) |

The only differences:
- Container vs. host execution (`docker exec` vs. direct spawn)
- Log prefix (`[chat]` vs. `[host-chat]`)

**Why this matters:** Any bug fix in stream parsing must be applied twice. Any improvement must be duplicated. Agents will fix one and forget the other.

### 1.3 oRPC Client Type Duplication (High)

Both `web/src/lib/api.ts` and `mobile/src/lib/api.ts` define their own oRPC client types inline:

```typescript
// web/src/lib/api.ts L50-105
const client = createORPCClient<{
  workspaces: { list: () => Promise<WorkspaceInfo[]>; ... }
  sessions: { ... }
  // ~55 lines of type definitions
}>(link)

// mobile/src/lib/api.ts L148-199
const client = createORPCClient<{
  workspaces: { list: () => Promise<WorkspaceInfo[]>; ... }
  sessions: { ... }
  // ~52 lines of type definitions (different!)
}>(link)
```

The router (`src/agent/router.ts`) is the **source of truth** but these client types are written manually. When the router changes, clients silently become incorrect.

### 1.4 Constant Duplication (Medium)

| Constant | Location 1 | Location 2 |
|----------|------------|------------|
| HOST_WORKSPACE_NAME | src/shared/types.ts:44 | src/shared/client-types.ts:93 |
| CONTAINER_PREFIX | src/shared/constants.ts:10 | src/docker/index.ts:16 |
| Default port 7391 | src/shared/constants.ts:1 | mobile/src/lib/api.ts:101 |
| Default model 'sonnet' | src/chat/handler.ts:56 | src/chat/host-handler.ts:46 |

---

## Part 2: Quality Tooling Gaps

### 2.1 Oxlint Configuration (Critical Gap)

**Current state** (`oxlint.json`):
```json
{
  "rules": {
    "no-unused-vars": "error",
    "no-console": "off",
    "eqeqeq": "error",
    "no-var": "error",
    "prefer-const": "error",
    "no-empty": "error",
    "no-useless-catch": "error"
  }
}
```

**7 rules out of 80+ available.** Missing high-value rules:

**Correctness (would catch bugs):**
- `no-self-compare` - catches `x === x` mistakes
- `no-constant-condition` - catches infinite loops
- `no-unreachable` - catches dead code
- `no-async-promise-executor` - catches async errors
- `no-floating-promises` - catches unhandled promises
- `no-loss-of-precision` - catches numeric bugs

**Code quality:**
- `max-lines` - catches overly long files
- `complexity` - catches complex functions
- `no-nested-ternary` - catches unreadable code
- `no-implicit-coercion` - catches type coercion bugs

**Security:**
- `no-eval` - catches security issues
- `no-implied-eval` - catches security issues

### 2.2 TypeScript Strictness Inconsistency (High Gap)

| Setting | Backend | Web | Mobile |
|---------|---------|-----|--------|
| strict | ✓ | ✓ | ✓ |
| noUnusedLocals | ✗ | ✓ | ✗ |
| noUnusedParameters | ✗ | ✓ | ✗ |
| noFallthroughCasesInSwitch | ✗ | ✓ | ✗ |
| noUncheckedSideEffectImports | ✗ | ✓ | ✗ |
| erasableSyntaxOnly | ✗ | ✓ | ✗ |

Web is stricter than backend/mobile. This inconsistency means:
- Code passing in backend might fail in web build
- Code passing in mobile might fail in web build
- Agents see different errors depending on where they're working

### 2.3 No Code Coverage (Critical Gap)

Vitest config (`vitest.config.js`) has **no coverage configuration**:
```javascript
export default defineConfig({
  test: {
    testTimeout: 120000,
    // NO coverage: { ... }
  },
});
```

This means:
- No visibility into what code is tested
- No enforcement of minimum coverage
- Agents can write code with zero test coverage
- Refactors can silently break untested paths

### 2.4 Pre-commit Hooks - INTENTIONALLY NOT USED

**Policy: Do not add pre-commit hooks to this project.**

Pre-commit hooks are intentionally avoided because:
- They slow down the development workflow
- CI is the appropriate place to catch errors
- Developers should be trusted to run checks manually when needed
- Hook setup complexity causes friction for new contributors

Errors are caught in CI after pushing, which is acceptable for this project's workflow.

### 2.5 CI Pipeline Gaps (High)

**Current `.github/workflows/test.yml`:**

```yaml
lint:
  - bun run lint          # Lints src/ only
  - bun run format:check  # Formats src/ and test/ only
  - bun x tsc --noEmit    # Typechecks backend only

# MISSING:
# - Web linting (bun run lint:web exists but not in CI)
# - Mobile linting (doesn't exist)
# - Mobile type checking
```

**Discrepancy in `bun run validate`:**
```bash
bun run check && bun run build && bun run test && bun run lint:web && bun run test:web
```

`lint:web` runs in `validate` but NOT in CI. This means:
- Local `bun run validate` catches web lint errors
- CI does NOT catch web lint errors
- Agents using CI as feedback will miss web issues

### 2.6 Mobile Has Zero Quality Checks (Critical Gap)

- No ESLint/Oxlint configuration
- No formatting check
- Minimal TypeScript config (just `extends expo/tsconfig.base`)
- E2E tests exist (Maestro) but not in main CI pipeline

### 2.7 ESLint Web Configuration Gaps (Medium)

`web/eslint.config.js` has:
```javascript
rules: {
  'custom/no-unstable-callback-props': 'warn',  // Custom only
  'react-hooks/set-state-in-effect': 'off',     // DISABLED (risky!)
  'react-refresh/only-export-components': ['warn', ...],
  'no-empty': ['error', { allowEmptyCatch: true }],
}
```

Missing common React rules:
- `react-hooks/exhaustive-deps` enforcement
- Import ordering
- Naming conventions
- Explicit return types for exported functions

---

## Part 3: Feedback Loop Failures

### 3.1 Where Agents Will Fail

**Scenario 1: Add new API endpoint**
1. Agent adds route to `src/agent/router.ts`
2. Agent updates `src/shared/client-types.ts`
3. Agent runs `bun run build` (copies types to web)
4. CI passes
5. **Mobile app silently breaks** - types not updated

**Scenario 2: Fix bug in chat handler**
1. Agent fixes bug in `src/chat/handler.ts`
2. Tests pass
3. CI passes
4. **Host chat still has bug** - `host-handler.ts` not updated

**Scenario 3: Add React component**
1. Agent writes component in `web/src/`
2. Agent runs tests, they pass
3. CI passes (web linting not enforced)
4. **Component has React hooks violation** - only caught by local validate

**Scenario 4: Mobile feature**
1. Agent writes feature in `mobile/src/`
2. No lint errors (no linter)
3. No type errors caught (loose config)
4. **Feature has subtle bugs** - only caught by manual testing

### 3.2 Current Feedback Loop Timing

| Issue Type | When Caught | Ideal |
|------------|-------------|-------|
| Backend lint error | CI (post-push) | CI |
| Backend type error | CI (post-push) | CI |
| Web lint error | CI (post-push) | CI |
| Mobile lint error | CI (post-push) | CI |
| Mobile type error | Build (maybe) | CI |
| API type drift (mobile) | Runtime | Build |
| Code duplication | Never | PR review |
| Missing coverage | Never | PR review |

---

## Part 4: Concrete Improvement Tasks

### 4.1 Immediate Wins (Shift Left)

#### Task 1: Fix CI Web Linting Gap
**Impact: High** | **Effort: Trivial**

Add to `.github/workflows/test.yml` lint job:
```yaml
- name: Lint web
  run: bun run lint:web
```

#### Task 3: Add Mobile Linting
**Impact: High** | **Effort: Low**

**STATUS: DONE** - Mobile is now included in the global `bun run lint` command.

The root `oxlint.json` configuration applies to both `src/` and `mobile/src/` directories.

#### Task 4: Expand Oxlint Rules
**Impact: High** | **Effort: Low**

Update `oxlint.json`:
```json
{
  "rules": {
    "no-unused-vars": "error",
    "eqeqeq": "error",
    "no-var": "error",
    "prefer-const": "error",
    "no-empty": "error",
    "no-useless-catch": "error",
    "no-self-compare": "error",
    "no-constant-condition": "error",
    "no-unreachable": "error",
    "no-loss-of-precision": "error",
    "no-debugger": "error",
    "no-duplicate-case": "error",
    "no-fallthrough": "error",
    "no-unsafe-finally": "error"
  }
}
```

### 4.2 Medium-term Improvements

#### Task 5: Add Code Coverage
**Impact: High** | **Effort: Medium**

Update `vitest.config.js`:
```javascript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['dist/**', 'test/**', 'web/**', 'mobile/**'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
});
```

#### Task 6: Unify TypeScript Strictness
**Impact: Medium** | **Effort: Low**

Create shared base config:

`tsconfig.strict.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Update `mobile/tsconfig.json`:
```json
{
  "extends": ["expo/tsconfig.base", "../tsconfig.strict.json"]
}
```

#### Task 7: Generate Client Types from Router
**Impact: Critical** | **Effort: Medium**

oRPC supports type inference. Create a shared types package:

```
packages/
  api-types/
    package.json
    src/
      index.ts  # Re-export AppRouter type
```

Then web and mobile can:
```typescript
import type { AppRouter } from '@perry/api-types';
const client = createORPCClient<AppRouter>(link);
```

This eliminates manual type sync entirely.

#### Task 8: Extract Chat Handler Base Class
**Impact: Medium** | **Effort: Medium**

Create `src/chat/base-chat-session.ts`:
```typescript
export abstract class BaseChatSession {
  protected buffer: string = '';
  protected sessionId?: string;
  protected model: string = 'sonnet';

  protected processBuffer(): void { /* shared impl */ }
  protected handleStreamMessage(msg: StreamMessage): void { /* shared impl */ }
  async interrupt(): Promise<void> { /* shared impl */ }

  abstract getSpawnArgs(message: string): string[];
  abstract getSpawnOptions(): SpawnOptions;
}
```

Then `ChatSession` and `HostChatSession` extend this.

### 4.3 Long-term Improvements

#### Task 9: Add API Contract Tests
**Impact: High** | **Effort: High**

Use snapshot testing for API responses:
```typescript
test('workspace.list returns expected shape', async () => {
  const result = await client.workspaces.list();
  expect(result).toMatchSnapshot();
});
```

Changes to API shape will fail tests, forcing explicit updates.

#### Task 10: Add Architecture Tests
**Impact: Medium** | **Effort: Medium**

Use `eslint-plugin-import` or similar to enforce:
- `web/` cannot import from `src/` directly
- `mobile/` cannot import from `src/` directly
- Only `shared/` types can be used across boundaries

---

## Part 5: Quality Metrics Dashboard

Recommended metrics to track:

| Metric | Current | Target | Tool |
|--------|---------|--------|------|
| Oxlint rules enabled | All categories | All categories | oxlint |
| Code coverage | Unknown | 70%+ | vitest |
| Type definition locations | 3 | 1 | manual |
| CI lint coverage | 100% | 100% | github actions |
| Duplicate code blocks | ~15 | <5 | jscpd |

---

## Part 6: Priority Matrix

| Task | Impact | Effort | Priority | Status |
|------|--------|--------|----------|--------|
| Fix CI web linting gap | High | Trivial | P0 | DONE |
| Add mobile linting | High | Low | P1 | DONE |
| Expand oxlint rules | High | Low | P1 | DONE (all categories enabled) |
| Add code coverage | High | Medium | P1 | |
| Unify TS strictness | Medium | Low | P2 | |
| Generate client types | Critical | Medium | P2 | |
| Extract chat base class | Medium | Medium | P2 | |
| API contract tests | High | High | P3 | |
| Architecture tests | Medium | Medium | P3 | |

---

## Conclusion

The codebase has solid foundations but leaky feedback loops. Agents can:
1. Introduce bugs that pass CI but fail in production
2. Create feature drift between web and mobile
3. Fix bugs in one place while leaving duplicates broken
4. Write untested code with no visibility

The most impactful immediate changes are:
1. **Fix CI to lint web** (literally one line) - DONE
2. **Expand oxlint rules** (catch more bugs automatically) - DONE (all categories enabled)
3. **Add mobile linting** (included in global lint command) - DONE
4. **Generate client types** (eliminate manual sync)

These changes shift feedback to CI, allowing agents to iterate with confidence.

**Note:** Pre-commit hooks are intentionally not used in this project. CI is the appropriate place to catch errors.
