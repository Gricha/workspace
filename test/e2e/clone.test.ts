import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestAgent, generateTestWorkspaceName, type TestAgent } from '../helpers/agent';
import * as docker from '../../src/docker';

describe('E2E - Workspace Cloning', () => {
  let agent: TestAgent;
  let sourceWorkspaceName: string;
  let cloneWorkspaceName: string;
  let sourceContainerName: string;
  let cloneContainerName: string;

  beforeAll(async () => {
    agent = await startTestAgent();
    sourceWorkspaceName = generateTestWorkspaceName();
    cloneWorkspaceName = `${sourceWorkspaceName}-clone`;
    sourceContainerName = `workspace-${sourceWorkspaceName}`;
    cloneContainerName = `workspace-${cloneWorkspaceName}`;
  }, 60000);

  afterAll(async () => {
    try {
      await agent.api.deleteWorkspace(sourceWorkspaceName);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await agent.api.deleteWorkspace(cloneWorkspaceName);
    } catch {
      // Ignore cleanup errors
    }
    if (agent) {
      await agent.cleanup();
    }
  });

  it('creates source workspace and writes test data', async () => {
    const result = await agent.api.createWorkspace({ name: sourceWorkspaceName });

    expect(result.status).toBe(201);
    expect(result.data.name).toBe(sourceWorkspaceName);
    expect(result.data.status).toBe('running');

    await docker.execInContainer(
      sourceContainerName,
      ['bash', '-c', 'echo "test-clone-data" > /home/workspace/clone-test.txt'],
      { user: 'workspace' }
    );

    await docker.execInContainer(
      sourceContainerName,
      [
        'bash',
        '-c',
        'mkdir -p /home/workspace/test-dir && echo "nested" > /home/workspace/test-dir/nested.txt',
      ],
      { user: 'workspace' }
    );

    const verifyResult = await docker.execInContainer(
      sourceContainerName,
      ['cat', '/home/workspace/clone-test.txt'],
      { user: 'workspace' }
    );
    expect(verifyResult.stdout.trim()).toBe('test-clone-data');
  }, 120000);

  it('clones workspace and preserves data', async () => {
    const result = await agent.api.cloneWorkspace(sourceWorkspaceName, cloneWorkspaceName);

    expect(result.status).toBe(201);
    expect(result.data.name).toBe(cloneWorkspaceName);
    expect(result.data.status).toBe('running');

    const cloneRunning = await docker.containerRunning(cloneContainerName);
    expect(cloneRunning).toBe(true);

    const fileResult = await docker.execInContainer(
      cloneContainerName,
      ['cat', '/home/workspace/clone-test.txt'],
      { user: 'workspace' }
    );
    expect(fileResult.stdout.trim()).toBe('test-clone-data');

    const nestedResult = await docker.execInContainer(
      cloneContainerName,
      ['cat', '/home/workspace/test-dir/nested.txt'],
      { user: 'workspace' }
    );
    expect(nestedResult.stdout.trim()).toBe('nested');
  }, 180000);

  it('clone has different SSH port than source', async () => {
    const sourceWorkspace = await agent.api.getWorkspace(sourceWorkspaceName);
    const cloneWorkspace = await agent.api.getWorkspace(cloneWorkspaceName);

    expect(sourceWorkspace).not.toBeNull();
    expect(cloneWorkspace).not.toBeNull();
    expect(cloneWorkspace!.ports.ssh).not.toBe(sourceWorkspace!.ports.ssh);
  }, 30000);

  it('clone and source are independent', async () => {
    await docker.execInContainer(
      cloneContainerName,
      ['bash', '-c', 'echo "clone-only" > /home/workspace/clone-only.txt'],
      { user: 'workspace' }
    );

    const cloneHasFile = await docker.execInContainer(
      cloneContainerName,
      ['cat', '/home/workspace/clone-only.txt'],
      { user: 'workspace' }
    );
    expect(cloneHasFile.stdout.trim()).toBe('clone-only');

    const sourceDoesntHaveFile = await docker.execInContainer(
      sourceContainerName,
      ['cat', '/home/workspace/clone-only.txt'],
      { user: 'workspace' }
    );
    expect(sourceDoesntHaveFile.exitCode).not.toBe(0);
  }, 30000);

  it('source workspace is running after clone', async () => {
    const sourceRunning = await docker.containerRunning(sourceContainerName);
    expect(sourceRunning).toBe(true);

    const sourceWorkspace = await agent.api.getWorkspace(sourceWorkspaceName);
    expect(sourceWorkspace?.status).toBe('running');
  }, 30000);

  it('deleting clone does not affect source', async () => {
    const deleteResult = await agent.api.deleteWorkspace(cloneWorkspaceName);
    expect(deleteResult.status).toBe(200);

    const cloneExists = await docker.containerExists(cloneContainerName);
    expect(cloneExists).toBe(false);

    const sourceRunning = await docker.containerRunning(sourceContainerName);
    expect(sourceRunning).toBe(true);

    const sourceFile = await docker.execInContainer(
      sourceContainerName,
      ['cat', '/home/workspace/clone-test.txt'],
      { user: 'workspace' }
    );
    expect(sourceFile.stdout.trim()).toBe('test-clone-data');
  }, 60000);
});
