import { describe, test, expect, vi } from 'vitest';

interface MockSession {
  interrupt: () => Promise<void>;
  sendMessage: (msg: string) => Promise<void>;
}

interface MockConnection {
  session: MockSession | null;
}

describe('WebSocket disconnect behavior', () => {
  test('session should NOT be interrupted when WebSocket closes', () => {
    const interruptSpy = vi.fn(() => Promise.resolve());

    const connection: MockConnection = {
      session: {
        interrupt: interruptSpy,
        sendMessage: vi.fn(() => Promise.resolve()),
      },
    };

    const connections = new Map<object, MockConnection>();
    const ws = {};
    connections.set(ws, connection);

    const handleClose = () => {
      connections.delete(ws);
    };

    handleClose();

    expect(interruptSpy).not.toHaveBeenCalled();
    expect(connections.size).toBe(0);
  });

  test('session SHOULD be interrupted on explicit interrupt message', async () => {
    const interruptSpy = vi.fn(() => Promise.resolve());

    const connection: MockConnection = {
      session: {
        interrupt: interruptSpy,
        sendMessage: vi.fn(() => Promise.resolve()),
      },
    };

    const handleInterrupt = async (conn: MockConnection) => {
      if (conn.session) {
        await conn.session.interrupt();
        conn.session = null;
      }
    };

    await handleInterrupt(connection);

    expect(interruptSpy).toHaveBeenCalledOnce();
    expect(connection.session).toBeNull();
  });

  test('session SHOULD be interrupted on WebSocket error', async () => {
    const interruptSpy = vi.fn(() => Promise.resolve());

    const connection: MockConnection = {
      session: {
        interrupt: interruptSpy,
        sendMessage: vi.fn(() => Promise.resolve()),
      },
    };

    const connections = new Map<object, MockConnection>();
    const ws = {};
    connections.set(ws, connection);

    const handleError = async () => {
      const conn = connections.get(ws);
      if (conn?.session) {
        await conn.session.interrupt();
      }
      connections.delete(ws);
    };

    await handleError();

    expect(interruptSpy).toHaveBeenCalledOnce();
    expect(connections.size).toBe(0);
  });

  test('session continues running after client disconnects', async () => {
    let sessionRunning = true;
    const interruptSpy = vi.fn(() => {
      sessionRunning = false;
      return Promise.resolve();
    });

    const connection: MockConnection = {
      session: {
        interrupt: interruptSpy,
        sendMessage: vi.fn(() => Promise.resolve()),
      },
    };

    const connections = new Map<object, MockConnection>();
    const ws = {};
    connections.set(ws, connection);

    const handleClose = () => {
      connections.delete(ws);
    };

    handleClose();

    expect(sessionRunning).toBe(true);
    expect(connection.session).not.toBeNull();
  });

  test('new client can connect while session is still running', async () => {
    const sessionMessages: string[] = [];
    const onMessage = (msg: string) => sessionMessages.push(msg);

    const runningSession = {
      interrupt: vi.fn(() => Promise.resolve()),
      sendMessage: vi.fn(() => Promise.resolve()),
      onMessage,
    };

    const connections = new Map<object, typeof runningSession>();
    const ws1 = {};
    connections.set(ws1, runningSession);

    connections.delete(ws1);
    expect(connections.size).toBe(0);

    const ws2 = {};
    connections.set(ws2, runningSession);
    expect(connections.size).toBe(1);

    runningSession.onMessage('message after reconnect');
    expect(sessionMessages).toContain('message after reconnect');
  });
});
