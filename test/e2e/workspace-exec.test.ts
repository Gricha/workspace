import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestAgent, type TestAgent } from '../helpers/agent';

describe('E2E - Workspace Exec Endpoint', () => {
  let agent: TestAgent;
  let workspaceName: string;

  beforeAll(async () => {
    agent = await startTestAgent();
    workspaceName = agent.generateWorkspaceName();

    // Create a workspace for testing
    const result = await agent.api.createWorkspace({ name: workspaceName });
    expect(result.status).toBe(201);
    expect(result.data.status).toBe('running');
  }, 120000);

  afterAll(async () => {
    try {
      await agent.api.deleteWorkspace(workspaceName);
    } catch {
      // Ignore cleanup errors
    }
    if (agent) {
      await agent.cleanup();
    }
  });

  describe('successful command execution', () => {
    it('executes a string command successfully', async () => {
      const result = await agent.api.execCommand(workspaceName, 'echo "Hello World"');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Hello World');
      expect(result.stderr).toBe('');
    });

    it('executes an array command successfully', async () => {
      const result = await agent.api.execCommand(workspaceName, ['echo', 'Hello', 'World']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Hello World');
      expect(result.stderr).toBe('');
    });

    it('executes pwd command', async () => {
      const result = await agent.api.execCommand(workspaceName, 'pwd');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('/workspace');
      expect(result.stderr).toBe('');
    });

    it('executes whoami command', async () => {
      const result = await agent.api.execCommand(workspaceName, 'whoami');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('workspace');
      expect(result.stderr).toBe('');
    });

    it('captures stdout and stderr separately', async () => {
      const result = await agent.api.execCommand(
        workspaceName,
        'echo "stdout message" && echo "stderr message" >&2'
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('stdout message');
      expect(result.stderr).toBe('stderr message');
    });

    it('executes complex shell commands with pipes', async () => {
      const result = await agent.api.execCommand(
        workspaceName,
        'echo -e "line1\\nline2\\nline3" | grep line2'
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('line2');
    });

    it('executes commands with environment variables', async () => {
      const result = await agent.api.execCommand(workspaceName, 'TEST_VAR=hello && echo $TEST_VAR');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello');
    });

    it('executes multi-line commands', async () => {
      const result = await agent.api.execCommand(workspaceName, 'FOO=bar\necho $FOO');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('bar');
    });
  });

  describe('command with non-zero exit code', () => {
    it('returns non-zero exit code for failing command', async () => {
      const result = await agent.api.execCommand(workspaceName, 'exit 42');

      expect(result.exitCode).toBe(42);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('returns non-zero exit code for non-existent command', async () => {
      const result = await agent.api.execCommand(workspaceName, 'nonexistentcommand123');

      expect(result.exitCode).not.toBe(0);
      // When running as workspace user, may get "Permission denied" or "not found"
      expect(result.stderr).toMatch(/not found|Permission denied/);
    });

    it('returns error for false command', async () => {
      const result = await agent.api.execCommand(workspaceName, 'false');

      expect(result.exitCode).toBe(1);
    });

    it('returns error for grep with no matches', async () => {
      const result = await agent.api.execCommand(workspaceName, 'echo "hello" | grep "goodbye"');

      expect(result.exitCode).toBe(1);
    });
  });

  describe('error handling', () => {
    it('throws NOT_FOUND error for non-existent workspace', async () => {
      await expect(
        agent.api.execCommand('nonexistent-workspace-12345', 'echo test')
      ).rejects.toThrow();

      try {
        await agent.api.execCommand('nonexistent-workspace-12345', 'echo test');
      } catch (err) {
        const error = err as { code?: string };
        expect(error.code).toBe('NOT_FOUND');
      }
    });

    it('throws PRECONDITION_FAILED error for stopped workspace', async () => {
      const stoppedWorkspaceName = agent.generateWorkspaceName();

      // Create and immediately stop the workspace
      await agent.api.createWorkspace({ name: stoppedWorkspaceName });
      await agent.api.stopWorkspace(stoppedWorkspaceName);

      await expect(agent.api.execCommand(stoppedWorkspaceName, 'echo test')).rejects.toThrow();

      try {
        await agent.api.execCommand(stoppedWorkspaceName, 'echo test');
      } catch (err) {
        const error = err as { code?: string };
        expect(error.code).toBe('PRECONDITION_FAILED');
      }

      // Cleanup
      await agent.api.deleteWorkspace(stoppedWorkspaceName);
    }, 120000);
  });

  describe('timeout handling', () => {
    it('times out long-running command with timeout parameter', async () => {
      await expect(agent.api.execCommand(workspaceName, 'sleep 10', 1000)).rejects.toThrow();

      try {
        await agent.api.execCommand(workspaceName, 'sleep 10', 1000);
      } catch (err) {
        const error = err as { code?: string; message?: string };
        expect(error.code).toBe('TIMEOUT');
        expect(error.message).toContain('timed out');
      }
    }, 15000);

    it('completes fast command within timeout', async () => {
      const result = await agent.api.execCommand(workspaceName, 'echo "fast command"', 5000);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('fast command');
    });

    it('executes command without timeout when not specified', async () => {
      const result = await agent.api.execCommand(workspaceName, 'sleep 1 && echo "done"');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('done');
    }, 10000);
  });

  describe('file operations', () => {
    it('creates and reads files', async () => {
      // Create a file
      const createResult = await agent.api.execCommand(
        workspaceName,
        'echo "test content" > /tmp/test-file.txt'
      );
      expect(createResult.exitCode).toBe(0);

      // Read the file
      const readResult = await agent.api.execCommand(workspaceName, 'cat /tmp/test-file.txt');
      expect(readResult.exitCode).toBe(0);
      expect(readResult.stdout).toBe('test content');
    });

    it('lists directory contents', async () => {
      const result = await agent.api.execCommand(workspaceName, ['ls', '-la', '/workspace']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('total');
    });

    it('checks file existence with test command', async () => {
      // Create a file first
      await agent.api.execCommand(workspaceName, 'touch /tmp/exists.txt');

      // Check if it exists
      const result = await agent.api.execCommand(
        workspaceName,
        'test -f /tmp/exists.txt && echo "exists"'
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('exists');
    });
  });

  describe('special characters and edge cases', () => {
    it('handles single quotes in commands', async () => {
      const result = await agent.api.execCommand(workspaceName, "echo 'Hello World'");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Hello World');
    });

    it('handles double quotes in commands', async () => {
      const result = await agent.api.execCommand(workspaceName, 'echo "Hello World"');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('Hello World');
    });

    it('handles commands with special characters', async () => {
      const result = await agent.api.execCommand(workspaceName, 'echo "test@#$%^&*()"');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('test@#$%^&*()');
    });

    it('handles empty command output', async () => {
      const result = await agent.api.execCommand(workspaceName, 'true');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('handles large output', async () => {
      const result = await agent.api.execCommand(workspaceName, 'seq 1 1000');

      expect(result.exitCode).toBe(0);
      const lines = result.stdout.split('\n').filter((l) => l);
      expect(lines.length).toBe(1000);
      expect(lines[0]).toBe('1');
      expect(lines[999]).toBe('1000');
    });
  });

  describe('command types comparison', () => {
    it('produces same result for string vs array command', async () => {
      const stringResult = await agent.api.execCommand(workspaceName, 'echo "test output"');

      const arrayResult = await agent.api.execCommand(workspaceName, ['echo', 'test output']);

      expect(stringResult.exitCode).toBe(arrayResult.exitCode);
      expect(stringResult.stdout).toBe(arrayResult.stdout);
    });

    it('handles spaces correctly in array command', async () => {
      const result = await agent.api.execCommand(workspaceName, [
        'echo',
        'hello world with spaces',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello world with spaces');
    });
  });

  describe('concurrent execution', () => {
    it('handles multiple simultaneous exec requests', async () => {
      const promises = [
        agent.api.execCommand(workspaceName, 'echo "command1"'),
        agent.api.execCommand(workspaceName, 'echo "command2"'),
        agent.api.execCommand(workspaceName, 'echo "command3"'),
      ];

      const results = await Promise.all(promises);

      expect(results[0].stdout).toBe('command1');
      expect(results[1].stdout).toBe('command2');
      expect(results[2].stdout).toBe('command3');
      results.forEach((r) => expect(r.exitCode).toBe(0));
    });
  });
});
