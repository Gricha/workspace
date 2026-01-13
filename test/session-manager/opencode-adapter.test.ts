import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenCodeAdapter } from '../../src/session-manager/adapters/opencode';

function createMockFetch() {
  const calls: Array<{ url: string; init?: RequestInit; json?: unknown }> = [];

  const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
    let parsedJson: unknown = undefined;
    if (init?.body) {
      parsedJson = JSON.parse(String(init.body));
    }
    calls.push({ url, init, json: parsedJson });

    if (url.endsWith('/session') && init?.method === 'GET') {
      return { ok: true, status: 200, json: async () => [] } as unknown as Response;
    }

    if (url.includes('/session/oc-session-123') && init?.method === 'GET') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'oc-session-123' }),
      } as unknown as Response;
    }

    if (url.endsWith('/session') && init?.method === 'POST') {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ id: 'oc-session-123' }),
      } as unknown as Response;
    }

    if (url.includes('/prompt_async') && init?.method === 'POST') {
      return { ok: true, status: 204, statusText: 'No Content' } as unknown as Response;
    }

    return { ok: false, status: 500, statusText: 'Unhandled request' } as unknown as Response;
  });

  return { mockFetch, calls };
}

describe('OpenCodeAdapter protocol', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // No-op: tests stub out `startSSEStream` and avoid server startup.
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends model on /prompt_async (not on POST /session)', async () => {
    const { mockFetch, calls } = createMockFetch();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const adapter = new OpenCodeAdapter();

    // Bypass startServerHost by setting the port directly.
    (adapter as unknown as { port: number; isHost: boolean }).port = 9999;
    (adapter as unknown as { isHost: boolean }).isHost = true;

    adapter.setModel('opencode/gpt-5.1-codex');

    // Also bypass SSE so sendMessage doesn't hang.
    (adapter as unknown as { startSSEStream: () => Promise<void> }).startSSEStream = () =>
      Promise.resolve();

    await adapter.sendMessage('hello');

    const createSessionCall = calls.find(
      (c) => c.url.endsWith('/session') && c.init?.method === 'POST'
    );
    expect(createSessionCall).toBeTruthy();
    expect(createSessionCall?.json).toEqual({});

    const promptCall = calls.find(
      (c) => c.url.includes('/prompt_async') && c.init?.method === 'POST'
    );
    expect(promptCall).toBeTruthy();
    expect(promptCall?.json).toMatchObject({
      model: 'opencode/gpt-5.1-codex',
      parts: [{ type: 'text', text: 'hello' }],
    });
  });

  it('refuses to create a new session when an agentSessionId is missing', async () => {
    const { mockFetch, calls } = createMockFetch();

    const failingFetch = vi.fn(async (url: string, init?: RequestInit) => {
      // Simulate resume id not found
      if (url.includes('/session/missing-session') && init?.method === 'GET') {
        return { ok: false, status: 404, statusText: 'Not Found' } as unknown as Response;
      }
      return mockFetch(url, init);
    });

    globalThis.fetch = failingFetch as unknown as typeof fetch;

    const adapter = new OpenCodeAdapter();
    (adapter as unknown as { port: number; isHost: boolean }).port = 9999;
    (adapter as unknown as { isHost: boolean }).isHost = true;

    (adapter as unknown as { agentSessionId?: string }).agentSessionId = 'missing-session';

    await expect(adapter.sendMessage('hello')).rejects.toThrow(/Refusing to create a new session/);

    // Ensure we did NOT create a new session.
    const createSessionCalls = calls.filter(
      (c) => c.url.endsWith('/session') && c.init?.method === 'POST'
    );
    expect(createSessionCalls).toHaveLength(0);
  });
});
