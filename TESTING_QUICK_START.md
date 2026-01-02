# TUI Testing Quick Start Guide

Fast track to testing your Node.js CLI with Vitest.

## What You Already Have

Your project is set up well for CLI testing:
- ✅ Vitest configured with proper isolation (`singleFork: true`)
- ✅ Example integration tests showing how to spawn processes
- ✅ Custom helpers in `test/helpers/`
- ✅ Commander.js CLI framework
- ✅ TypeScript support

## New: Two Minimal Helper Files

I've created two new test helpers ready to use:

### 1. **test/helpers/cli-runner.ts** (Simple output testing)

No dependencies needed. Tests CLI output and exit codes.

```typescript
import { runCLI, stripANSI } from '../helpers/cli-runner';

it('lists workspaces', async () => {
  const { stdout, code } = await runCLI(['list']);
  expect(code).toBe(0);
  expect(stripANSI(stdout)).toContain('workspace');
});
```

**Functions:**
- `runCLI(args, options?)` - Run CLI and capture output
- `stripANSI(str)` - Remove color codes
- `hasText(output, text)` - Check if output contains text
- `runCLIExpecting(args, expected)` - Run and assert in one call
- `runCLIExpectingError(args, expectedError?)` - Expect failure

### 2. **test/helpers/interactive-cli-runner.ts** (User input simulation)

For when you have prompts/interactive menus. Requires `mock-stdin`:

```bash
npm install --save-dev mock-stdin
```

```typescript
import { runInteractiveCLI, TERMINAL_KEYS, withEnter } from '../helpers/interactive-cli-runner';

it('handles text input', async () => {
  const { stdout, code } = await runInteractiveCLI(
    ['create'],
    withEnter(['my-workspace'])
  );
  expect(code).toBe(0);
  expect(stdout).toContain('created');
});

it('navigates menu', async () => {
  const { stdout } = await runInteractiveCLI(
    ['select-workspace'],
    [
      TERMINAL_KEYS.DOWN,
      TERMINAL_KEYS.DOWN,
      TERMINAL_KEYS.ENTER
    ]
  );
  expect(stdout).toContain('selected');
});
```

**Functions:**
- `runInteractiveCLI(args, inputs, options?)` - Run with simulated input
- `runPromptCLI(args, responses)` - Simple text responses
- `runMenuCLI(args, selectIndex)` - Select menu item by index
- `TERMINAL_KEYS` - Object with keyboard shortcuts
- `withEnter(texts)` - Add Enter after each text input
- `extractLines(output)` - Parse output into lines
- `findLine(output, pattern)` - Find specific line

## Quick Examples

### Test 1: Simple Output

```typescript
import { describe, it, expect } from 'vitest';
import { runCLI, stripANSI } from '../helpers/cli-runner';

describe('workspace list', () => {
  it('displays workspaces', async () => {
    const { stdout, code } = await runCLI(['list']);
    expect(code).toBe(0);
    expect(stripANSI(stdout)).toContain('Status');
    expect(stripANSI(stdout)).toContain('SSH Port');
  });
});
```

### Test 2: Error Handling

```typescript
import { runCLIExpectingError } from '../helpers/cli-runner';

describe('error cases', () => {
  it('fails on missing name', async () => {
    const result = await runCLIExpectingError(
      ['create'],
      'name' // Expected in error message
    );
    expect(result.code).not.toBe(0);
  });
});
```

### Test 3: Interactive Input (With mock-stdin)

```typescript
import { runPromptCLI, TERMINAL_KEYS } from '../helpers/interactive-cli-runner';

describe('interactive prompts', () => {
  it('creates workspace interactively', async () => {
    const { stdout, code } = await runPromptCLI(
      ['create', '--interactive'],
      ['my-workspace', 'docker']
    );
    expect(code).toBe(0);
    expect(stdout).toContain('created');
  });

  it('confirms deletion', async () => {
    const { stdout } = await runInteractiveCLI(
      ['delete', 'test-ws'],
      ['y', TERMINAL_KEYS.ENTER] // Confirm with 'y'
    );
    expect(stdout).toContain('deleted');
  });
});
```

### Test 4: Menu Navigation

```typescript
import { runMenuCLI } from '../helpers/interactive-cli-runner';

describe('menu selection', () => {
  it('selects second workspace', async () => {
    const { stdout } = await runMenuCLI(
      ['select'],
      1 // Select index 1 (second item)
    );
    expect(stdout).toContain('selected');
  });
});
```

### Test 5: Full Workflow

```typescript
describe('workspace lifecycle', () => {
  it('creates, lists, and deletes', async () => {
    // Create
    let result = await runCLI(['create', 'test-ws']);
    expect(result.code).toBe(0);

    // List
    result = await runCLI(['list']);
    expect(stripANSI(result.stdout)).toContain('test-ws');

    // Delete
    result = await runCLI(['delete', 'test-ws', '--force']);
    expect(result.code).toBe(0);
  });
}, 120000); // Docker operations need time
```

## Installation: Optional Dependencies

### For interactive testing (if you add prompts):

```bash
npm install --save-dev mock-stdin
```

**Note:** This is optional. Works without it for simple CLI testing.

## Running Tests

```bash
# Run all tests
npm test

# Run only CLI tests
npm test -- test/cli

# Watch mode
npm run test:watch -- test/cli

# Specific file
npm test -- test/cli/basic.test.ts

# With output
npm test -- --reporter=verbose
```

## Common Patterns

### Check output contains text
```typescript
expect(stripANSI(stdout)).toContain('expected');
```

### Check JSON output
```typescript
const json = JSON.parse(stdout);
expect(json.status).toBe('running');
```

### Check error message
```typescript
const result = await runCLIExpectingError(['bad'], 'error message');
expect(result.code).not.toBe(0);
```

### Simulate menu down arrow 3 times
```typescript
const inputs = [
  TERMINAL_KEYS.DOWN,
  TERMINAL_KEYS.DOWN,
  TERMINAL_KEYS.DOWN,
  TERMINAL_KEYS.ENTER
];
const { stdout } = await runInteractiveCLI(['menu'], inputs);
```

### Long timeout for Docker
```typescript
it('creates workspace', async () => {
  // ... test code
}, 120000); // 2 minutes
```

### Unique test workspace names
```typescript
const wsName = `test-ws-${Date.now()}`;
const { stdout } = await runCLI(['create', wsName]);
```

## File Structure

```
test/
├── helpers/
│   ├── cli-runner.ts          ← Use this for simple tests
│   ├── interactive-cli-runner.ts ← Use this for prompts/menus
│   ├── agent.ts               ← Existing, for agent testing
│   └── ...
├── cli/
│   ├── basic-commands.test.ts ← Example: simple output
│   ├── interactive.test.ts    ← Example: with input
│   └── ...
├── e2e/
│   └── workspace.test.ts      ← Existing full workflow tests
└── ...
```

## When to Use What

| Need | Helper | Example |
|------|--------|---------|
| Test output only | `cli-runner.ts` | `runCLI(['list'])` |
| Check for errors | `cli-runner.ts` | `runCLIExpectingError(['bad'])` |
| Text input prompts | `interactive-cli-runner.ts` | `runPromptCLI(args, ['response'])` |
| Menu selection | `interactive-cli-runner.ts` | `runMenuCLI(args, 1)` |
| Key presses | `interactive-cli-runner.ts` | `runInteractiveCLI(args, [KEYS.UP, KEYS.ENTER])` |

## Troubleshooting

### "CLI timed out"
→ Increase timeout: `runCLI(args, { timeout: 30000 })`

### Output is empty
→ CLI might be writing to stderr, check both: `stderr` and `stdout`

### Test passes but output looks wrong
→ Use `stripANSI()` to remove color codes before comparing

### "interactive-cli-runner" needs mock-stdin
→ Install it: `npm install --save-dev mock-stdin`

### Process hangs on input
→ Make sure to close stdin after inputs: handled automatically

## Next Steps

1. **Copy the two helper files** - Already created in `test/helpers/`

2. **Create a simple test file** - Try `test/cli/basic.test.ts`:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { runCLI, stripANSI } from '../helpers/cli-runner';

   describe('workspace CLI', () => {
     it('shows version', async () => {
       const { stdout, code } = await runCLI(['--version']);
       expect(code).toBe(0);
       expect(stdout).toMatch(/\d+\.\d+\.\d+/);
     });
   });
   ```

3. **Run the test** - `npm test test/cli/basic.test.ts`

4. **Add more tests** - Use the patterns above

5. **For interactive tests** - Install mock-stdin if needed, then use `interactive-cli-runner.ts`

## Reference Documents

For more details, see:
- **TUI_TESTING_RESEARCH.md** - Comprehensive research and recommendations
- **TUI_TESTING_EXAMPLES.md** - Detailed copy-paste examples
- **test/helpers/cli-runner.ts** - Simple helper source
- **test/helpers/interactive-cli-runner.ts** - Interactive helper source

---

**That's it!** You're ready to test your CLI with minimal setup. Start simple with `runCLI()` and add `runInteractiveCLI()` only if you need to test prompts.
