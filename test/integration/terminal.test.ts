import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { startTestAgent, generateTestWorkspaceName, type TestAgent } from '../helpers/agent';
import type { ControlMessage } from '../../src/terminal/types';

function waitForMessage(ws: WebSocket, timeout = 5000): Promise<Buffer | string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for message'));
    }, timeout);

    ws.once('message', (data: Buffer | string) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function waitForOpen(ws: WebSocket, timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for connection'));
    }, timeout);

    ws.once('open', () => {
      clearTimeout(timer);
      resolve();
    });

    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function collectMessages(ws: WebSocket, duration: number): Promise<string> {
  return new Promise((resolve) => {
    let output = '';
    const handler = (data: Buffer | string) => {
      output += data.toString();
    };

    ws.on('message', handler);

    setTimeout(() => {
      ws.off('message', handler);
      resolve(output);
    }, duration);
  });
}

describe('Terminal WebSocket', () => {
  let agent: TestAgent;
  let workspaceName: string;
  let workspaceCreated = false;

  beforeAll(async () => {
    agent = await startTestAgent();
    workspaceName = generateTestWorkspaceName();

    const result = await agent.api.createWorkspace({ name: workspaceName });
    if (result.status === 201) {
      workspaceCreated = true;
    }
  }, 120000);

  afterAll(async () => {
    if (workspaceCreated) {
      try {
        await agent.api.deleteWorkspace(workspaceName);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (agent) {
      await agent.cleanup();
    }
  });

  it('returns 404 for non-existent workspace terminal', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${agent.port}/rpc/terminal/nonexistent`);

    const error = await new Promise<{ code: number; reason: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), 5000);

      ws.on('error', () => {
        // Expected - connection refused after 404
      });

      ws.on('unexpected-response', (_req, res) => {
        clearTimeout(timer);
        resolve({ code: res.statusCode || 0, reason: res.statusMessage || '' });
        ws.close();
      });

      ws.on('open', () => {
        clearTimeout(timer);
        reject(new Error('Should not have connected'));
        ws.close();
      });
    });

    expect(error.code).toBe(404);
  });

  it('can open terminal WebSocket connection', async function () {
    if (!workspaceCreated) {
      console.log('Skipping: workspace image not available');
      return;
    }

    const ws = new WebSocket(`ws://127.0.0.1:${agent.port}/rpc/terminal/${workspaceName}`);

    await waitForOpen(ws);
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
  }, 30000);

  it('can send command and receive output', async function () {
    if (!workspaceCreated) {
      console.log('Skipping: workspace image not available');
      return;
    }

    const ws = new WebSocket(`ws://127.0.0.1:${agent.port}/rpc/terminal/${workspaceName}`);

    await waitForOpen(ws);

    const outputPromise = collectMessages(ws, 2000);
    ws.send('echo "HELLO_FROM_TERMINAL"\n');

    const output = await outputPromise;
    expect(output).toContain('HELLO_FROM_TERMINAL');

    ws.close();
  }, 30000);

  it('handles resize control message without error', async function () {
    if (!workspaceCreated) {
      console.log('Skipping: workspace image not available');
      return;
    }

    const ws = new WebSocket(`ws://127.0.0.1:${agent.port}/rpc/terminal/${workspaceName}`);

    await waitForOpen(ws);

    const resizeMessage: ControlMessage = {
      type: 'resize',
      cols: 120,
      rows: 40,
    };

    let errorOccurred = false;
    ws.once('error', () => {
      errorOccurred = true;
    });

    ws.send(JSON.stringify(resizeMessage));

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(errorOccurred).toBe(false);
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
  }, 30000);

  it('supports multiple terminal connections to same workspace', async function () {
    if (!workspaceCreated) {
      console.log('Skipping: workspace image not available');
      return;
    }

    const ws1 = new WebSocket(`ws://127.0.0.1:${agent.port}/rpc/terminal/${workspaceName}`);
    const ws2 = new WebSocket(`ws://127.0.0.1:${agent.port}/rpc/terminal/${workspaceName}`);

    await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

    expect(ws1.readyState).toBe(WebSocket.OPEN);
    expect(ws2.readyState).toBe(WebSocket.OPEN);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const info = await agent.api.info();
    expect(info.terminalConnections).toBeGreaterThanOrEqual(2);

    ws1.close();
    ws2.close();
  }, 30000);

  it('cleans up terminal connection on close', async function () {
    if (!workspaceCreated) {
      console.log('Skipping: workspace image not available');
      return;
    }

    const infoBefore = await agent.api.info();
    const connectionsBefore = infoBefore.terminalConnections;

    const ws = new WebSocket(`ws://127.0.0.1:${agent.port}/rpc/terminal/${workspaceName}`);

    await waitForOpen(ws);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const infoDuring = await agent.api.info();
    expect(infoDuring.terminalConnections).toBeGreaterThan(connectionsBefore);

    const closePromise = new Promise<void>((resolve) => {
      ws.once('close', () => resolve());
    });
    ws.close();
    await closePromise;

    await new Promise((resolve) => setTimeout(resolve, 500));

    const infoAfter = await agent.api.info();
    expect(infoAfter.terminalConnections).toBe(connectionsBefore);
  }, 30000);

  it('closes terminal connections when workspace stops', async function () {
    if (!workspaceCreated) {
      console.log('Skipping: workspace image not available');
      return;
    }

    const ws = new WebSocket(`ws://127.0.0.1:${agent.port}/rpc/terminal/${workspaceName}`);

    await waitForOpen(ws);

    const closePromise = new Promise<number>((resolve) => {
      ws.on('close', (code) => {
        resolve(code);
      });
    });

    await agent.api.stopWorkspace(workspaceName);

    const closeCode = await closePromise;
    expect(closeCode).toBe(1001);

    await agent.api.startWorkspace(workspaceName);
  }, 60000);
});
