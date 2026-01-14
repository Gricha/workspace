import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

// Ensure we don't accidentally spawn processes in unit tests.
function stubEnsureOpenCodeServer() {
  return vi.fn(async () => 12345);
}

describe('OpenCode server config wiring', () => {
  const originalEnsure = (globalThis as any).__ensureOpenCodeServer;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    (globalThis as any).__ensureOpenCodeServer = originalEnsure;
    vi.restoreAllMocks();
  });

  test('passes hostname/auth from agent config into ensureOpenCodeServer', async () => {
    const ensureMock = stubEnsureOpenCodeServer();

    vi.doMock('../../src/session-manager/opencode/server', () => ({
      ensureOpenCodeServer: ensureMock,
    }));

    vi.doMock('../../src/config/loader', () => ({
      loadAgentConfig: async () => ({
        port: 7391,
        credentials: { env: {}, files: {} },
        scripts: {},
        agents: {
          opencode: {
            server: {
              hostname: '127.0.0.1',
              username: 'opencode',
              password: 'pw',
            },
          },
        },
      }),
    }));

    // Import after mocks are registered.
    const { OpenCodeAdapter: MockedAdapter } =
      await import('../../src/session-manager/adapters/opencode');

    const adapter = new MockedAdapter();

    await adapter.start({
      workspaceName: 'test',
      containerName: 'workspace-test',
      isHost: false,
      configDir: '/tmp/ignored',
    });

    expect(ensureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: '127.0.0.1',
        auth: { username: 'opencode', password: 'pw' },
      })
    );
  });
});
