import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { startTestAgent, generateTestWorkspaceName, type TestAgent } from '../helpers/agent';

describe('Credential Injection', () => {
  let agent: TestAgent;
  let workspaceName: string;
  let tempDir: string;
  let testFilePath: string;
  let privateKeyPath: string;
  let publicKeyPath: string;
  let postStartScriptPath: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-cred-test-'));

    testFilePath = path.join(tempDir, 'test-config.txt');
    await fs.writeFile(testFilePath, 'test-config-content');

    privateKeyPath = path.join(tempDir, 'id_test');
    publicKeyPath = path.join(tempDir, 'id_test.pub');
    await fs.writeFile(privateKeyPath, 'FAKE_PRIVATE_KEY_CONTENT');
    await fs.writeFile(publicKeyPath, 'ssh-ed25519 AAAAC... test@test.local');

    postStartScriptPath = path.join(tempDir, 'post-start.sh');
    await fs.writeFile(
      postStartScriptPath,
      `#!/bin/bash
echo "POST_START_RAN" > /home/workspace/.post-start-marker
`
    );
    await fs.chmod(postStartScriptPath, 0o755);

    agent = await startTestAgent({
      config: {
        credentials: {
          env: {
            TEST_API_KEY: 'test-secret-key-123',
            GITHUB_TOKEN: 'ghp_testtoken',
          },
          files: {
            '~/.test-config': testFilePath,
            '~/.ssh/id_test': privateKeyPath,
            '~/.ssh/id_test.pub': publicKeyPath,
          },
        },
        scripts: {
          post_start: postStartScriptPath,
        },
      },
    });
  }, 60000);

  afterAll(async () => {
    if (agent) {
      await agent.cleanup();
    }
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    workspaceName = generateTestWorkspaceName();
  });

  afterEach(async () => {
    try {
      await agent.api.deleteWorkspace(workspaceName);
    } catch {
      // Ignore
    }
  });

  describe('Environment Variables', () => {
    it('injects environment variables into workspace', async () => {
      await agent.api.createWorkspace({ name: workspaceName });

      const { execInContainer } = await import('../../src/docker');
      const containerName = `workspace-${workspaceName}`;

      const result = await execInContainer(containerName, ['bash', '-c', 'echo $TEST_API_KEY'], {
        user: 'workspace',
      });

      expect(result.stdout.trim()).toBe('test-secret-key-123');
    }, 120000);

    it('injects multiple environment variables', async () => {
      await agent.api.createWorkspace({ name: workspaceName });

      const { execInContainer } = await import('../../src/docker');
      const containerName = `workspace-${workspaceName}`;

      const result = await execInContainer(containerName, ['bash', '-c', 'echo $GITHUB_TOKEN'], {
        user: 'workspace',
      });

      expect(result.stdout.trim()).toBe('ghp_testtoken');
    }, 120000);
  });

  describe('Files', () => {
    it('copies files into workspace', async () => {
      await agent.api.createWorkspace({ name: workspaceName });

      const { execInContainer } = await import('../../src/docker');
      const containerName = `workspace-${workspaceName}`;

      const result = await execInContainer(containerName, ['cat', '/home/workspace/.test-config'], {
        user: 'workspace',
      });

      expect(result.stdout.trim()).toBe('test-config-content');
    }, 120000);
  });

  describe('SSH Keys', () => {
    it('copies SSH keys with correct permissions', async () => {
      await agent.api.createWorkspace({ name: workspaceName });

      const { execInContainer } = await import('../../src/docker');
      const containerName = `workspace-${workspaceName}`;

      const result = await execInContainer(
        containerName,
        ['stat', '-c', '%a', '/home/workspace/.ssh/id_test'],
        { user: 'workspace' }
      );

      expect(result.stdout.trim()).toBe('600');
    }, 120000);

    it('copies public key with correct permissions', async () => {
      await agent.api.createWorkspace({ name: workspaceName });

      const { execInContainer } = await import('../../src/docker');
      const containerName = `workspace-${workspaceName}`;

      const result = await execInContainer(
        containerName,
        ['stat', '-c', '%a', '/home/workspace/.ssh/id_test.pub'],
        { user: 'workspace' }
      );

      expect(result.stdout.trim()).toBe('644');
    }, 120000);
  });

  describe('Post-start Script', () => {
    it('executes post-start script', async () => {
      await agent.api.createWorkspace({ name: workspaceName });

      const { execInContainer } = await import('../../src/docker');
      const containerName = `workspace-${workspaceName}`;

      const result = await execInContainer(
        containerName,
        ['cat', '/home/workspace/.post-start-marker'],
        { user: 'workspace' }
      );

      expect(result.stdout.trim()).toBe('POST_START_RAN');
    }, 120000);
  });
});
