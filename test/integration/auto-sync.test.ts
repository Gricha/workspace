import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { startTestAgent, generateTestWorkspaceName, type TestAgent } from '../helpers/agent';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Auto-Sync', () => {
  let agent: TestAgent;
  let workspaceName: string;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-auto-sync-test-'));
  }, 60000);

  afterAll(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    workspaceName = generateTestWorkspaceName();
  });

  afterEach(async () => {
    try {
      await agent?.api.deleteWorkspace(workspaceName);
    } catch {
      // Ignore
    }
    if (agent) {
      await agent.cleanup();
    }
  });

  describe('API Config Changes', () => {
    it('syncs credentials to running workspace when config updated via API', async () => {
      const testFile = path.join(tempDir, 'sync-test.txt');
      await fs.writeFile(testFile, 'initial-content');

      agent = await startTestAgent({
        config: {
          credentials: {
            env: {},
            files: { '~/.sync-test': testFile },
          },
        },
      });

      await agent.api.createWorkspace({ name: workspaceName });

      let result = await agent.exec(workspaceName, 'cat /home/workspace/.sync-test');
      expect(result.stdout).toBe('initial-content');

      const newFile = path.join(tempDir, 'new-sync-test.txt');
      await fs.writeFile(newFile, 'new-content');

      await fetch(`${agent.baseUrl}/rpc/config/credentials/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            env: {},
            files: {
              '~/.sync-test': testFile,
              '~/.new-sync-test': newFile,
            },
          },
        }),
      });

      await sleep(1000);

      result = await agent.exec(workspaceName, 'cat /home/workspace/.new-sync-test');
      expect(result.stdout).toBe('new-content');
    }, 180000);
  });

  describe('File Watching', () => {
    it('syncs to workspace when watched credential file changes', async () => {
      const watchedFile = path.join(tempDir, 'watched.txt');
      await fs.writeFile(watchedFile, 'original');

      agent = await startTestAgent({
        config: {
          credentials: {
            env: {},
            files: { '~/.watched': watchedFile },
          },
        },
      });

      await agent.api.createWorkspace({ name: workspaceName });

      let result = await agent.exec(workspaceName, 'cat /home/workspace/.watched');
      expect(result.stdout).toBe('original');

      await fs.writeFile(watchedFile, 'modified-content');

      await sleep(1500);

      result = await agent.exec(workspaceName, 'cat /home/workspace/.watched');
      expect(result.stdout).toBe('modified-content');
    }, 180000);

    it('debounces rapid file changes', async () => {
      const watchedFile = path.join(tempDir, 'debounce-test.txt');
      await fs.writeFile(watchedFile, 'v1');

      agent = await startTestAgent({
        config: {
          credentials: {
            env: {},
            files: { '~/.debounce-test': watchedFile },
          },
        },
      });

      await agent.api.createWorkspace({ name: workspaceName });

      await fs.writeFile(watchedFile, 'v2');
      await sleep(100);
      await fs.writeFile(watchedFile, 'v3');
      await sleep(100);
      await fs.writeFile(watchedFile, 'v4-final');

      await sleep(1500);

      const result = await agent.exec(workspaceName, 'cat /home/workspace/.debounce-test');
      expect(result.stdout).toBe('v4-final');
    }, 180000);
  });

  describe('Directory Sync', () => {
    it('syncs entire directory to workspace', async () => {
      const syncDir = path.join(tempDir, 'sync-dir');
      await fs.mkdir(syncDir, { recursive: true });
      await fs.writeFile(path.join(syncDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(syncDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(syncDir, 'subdir'));
      await fs.writeFile(path.join(syncDir, 'subdir', 'nested.txt'), 'nested-content');

      agent = await startTestAgent({
        config: {
          credentials: {
            env: {},
            files: { '~/.sync-dir': syncDir },
          },
        },
      });

      await agent.api.createWorkspace({ name: workspaceName });

      let result = await agent.exec(workspaceName, 'cat /home/workspace/.sync-dir/file1.txt');
      expect(result.stdout).toBe('content1');

      result = await agent.exec(workspaceName, 'cat /home/workspace/.sync-dir/file2.txt');
      expect(result.stdout).toBe('content2');

      result = await agent.exec(workspaceName, 'cat /home/workspace/.sync-dir/subdir/nested.txt');
      expect(result.stdout).toBe('nested-content');
    }, 180000);
  });
});
