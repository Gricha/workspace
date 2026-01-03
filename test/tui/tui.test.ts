import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  createTuiHarness,
  startTuiTest,
  createTestConfigDir,
  cleanupTestConfigDir,
  type TuiTestHarness,
} from './harness';
import { startTestAgent, generateTestWorkspaceName, type TestAgent } from '../helpers/agent';
import path from 'path';

describe('TUI', () => {
  let agent: TestAgent;

  beforeAll(async () => {
    agent = await startTestAgent();
  }, 60000);

  afterAll(async () => {
    if (agent) {
      await agent.cleanup();
    }
  });

  describe('Worker Configuration', () => {
    test('prompts for worker when not configured', async () => {
      const harness = await startTuiTest();

      try {
        await harness.waitForText('No worker configured', 5000);
        await harness.waitForText('Enter worker hostname', 5000);
      } finally {
        await harness.close();
      }
    }, 30000);
  });

  describe('Workspace List', () => {
    let harness: TuiTestHarness & { configDir: string };

    afterEach(async () => {
      if (harness) {
        await harness.close();
      }
    });

    test('shows workspace manager header after connecting', async () => {
      harness = await startTuiTest(`http://127.0.0.1:${agent.port}`);

      await harness.waitForText('Workspace Manager', 10000);
    }, 30000);

    test('shows empty state message', async () => {
      harness = await startTuiTest(`http://127.0.0.1:${agent.port}`);
      await harness.waitForText('Workspace Manager', 10000);
      await harness.waitForText('No workspaces yet', 5000);
    }, 30000);

    test('shows keyboard shortcuts in footer', async () => {
      harness = await startTuiTest(`http://127.0.0.1:${agent.port}`);
      await harness.waitForText('Workspace Manager', 10000);
      await harness.waitForText('q:quit', 5000);
      await harness.waitForText('n:new', 5000);
      await harness.waitForText('r:refresh', 5000);
    }, 30000);

    test('exits on q key', async () => {
      harness = await startTuiTest(`http://127.0.0.1:${agent.port}`);
      await harness.waitForText('Workspace Manager', 10000);
      harness.sendKey('q');
      const exitCode = await harness.close();
      expect(exitCode).toBe(0);
    }, 30000);
  });

  describe('Workspace Navigation', () => {
    let harness: TuiTestHarness & { configDir: string };
    let workspaceName: string;

    beforeAll(async () => {
      workspaceName = generateTestWorkspaceName();
      await agent.api.createWorkspace({ name: workspaceName });
    }, 120000);

    afterAll(async () => {
      try {
        await agent.api.deleteWorkspace(workspaceName);
      } catch {}
    });

    afterEach(async () => {
      if (harness) {
        await harness.close();
      }
    });

    test('shows workspace in list', async () => {
      harness = await startTuiTest(`http://127.0.0.1:${agent.port}`);
      await harness.waitForText('Workspace Manager', 10000);
      await harness.waitForText(workspaceName, 10000);
    }, 30000);

    test('can select workspace and view detail', async () => {
      harness = await startTuiTest(`http://127.0.0.1:${agent.port}`);
      await harness.waitForText('Workspace Manager', 10000);
      await harness.waitForText(workspaceName, 10000);

      harness.sendKey('enter');
      await harness.waitForText(`Workspace: ${workspaceName}`, 5000);
      await harness.waitForText('Status:', 5000);
    }, 30000);

    test('shows detail view keyboard shortcuts', async () => {
      harness = await startTuiTest(`http://127.0.0.1:${agent.port}`);
      await harness.waitForText('Workspace Manager', 10000);
      await harness.waitForText(workspaceName, 10000);

      harness.sendKey('enter');
      await harness.waitForText(`Workspace: ${workspaceName}`, 5000);
      await harness.waitForText('esc:back', 5000);
      await harness.waitForText('s:start/stop', 5000);
      await harness.waitForText('d:delete', 5000);
    }, 30000);

    test('can go back to list with escape', async () => {
      harness = await startTuiTest(`http://127.0.0.1:${agent.port}`);
      await harness.waitForText('Workspace Manager', 10000);
      await harness.waitForText(workspaceName, 10000);

      harness.sendKey('enter');
      await harness.waitForText(`Workspace: ${workspaceName}`, 5000);

      harness.sendKey('escape');
      await harness.waitForText('n:new', 5000);
    }, 30000);

    test('can navigate with arrow keys', async () => {
      harness = await startTuiTest(`http://127.0.0.1:${agent.port}`);
      await harness.waitForText('Workspace Manager', 10000);
      await harness.waitForText(workspaceName, 10000);

      harness.sendKey('down');
      await harness.waitFor(100);
      harness.sendKey('up');
      await harness.waitFor(100);
    }, 30000);

    test('refresh reloads workspaces', async () => {
      harness = await startTuiTest(`http://127.0.0.1:${agent.port}`);
      await harness.waitForText('Workspace Manager', 10000);
      await harness.waitForText(workspaceName, 10000);

      harness.sendKey('r');
      await harness.waitForText(workspaceName, 10000);
    }, 30000);
  });
});
