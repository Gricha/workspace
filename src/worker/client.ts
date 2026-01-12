import { getContainerIp, execInContainer } from '../docker';
import type { IndexedSession, Message } from './session-index';

const WORKER_PORT = 7392;
const HEALTH_TIMEOUT = 2000;
const REQUEST_TIMEOUT = 30000;
const STARTUP_TIMEOUT = 15000;
const STARTUP_POLL_INTERVAL = 200;

export interface WorkerHealth {
  status: 'ok';
  version: string;
  sessionCount: number;
}

export interface WorkerClient {
  health(): Promise<WorkerHealth>;
  listSessions(): Promise<IndexedSession[]>;
  getSession(id: string): Promise<IndexedSession | null>;
  getMessages(
    id: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<{ id: string; messages: Message[]; total: number }>;
  deleteSession(id: string): Promise<{ success: boolean; error?: string }>;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const timeout = options.timeout ?? REQUEST_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function isWorkerRunning(ip: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`http://${ip}:${WORKER_PORT}/health`, {
      timeout: HEALTH_TIMEOUT,
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function startWorkerInContainer(containerName: string): Promise<void> {
  await execInContainer(
    containerName,
    [
      'sh',
      '-c',
      "nohup sh -c 'if [ -x /usr/local/bin/perry ]; then exec /usr/local/bin/perry worker serve; else exec perry worker serve; fi' > /tmp/perry-worker.log 2>&1 &",
    ],
    { user: 'workspace' }
  );
}

async function ensureWorkerRunning(containerName: string): Promise<string> {
  const ip = await getContainerIp(containerName);
  if (!ip) {
    throw new Error(`Could not get IP for container: ${containerName}`);
  }

  if (await isWorkerRunning(ip)) {
    return ip;
  }

  await startWorkerInContainer(containerName);

  const deadline = Date.now() + STARTUP_TIMEOUT;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, STARTUP_POLL_INTERVAL));
    if (await isWorkerRunning(ip)) {
      return ip;
    }
  }

  throw new Error(`Worker failed to start in container: ${containerName}`);
}

export async function createWorkerClient(containerName: string): Promise<WorkerClient> {
  const ip = await ensureWorkerRunning(containerName);
  const baseUrl = `http://${ip}:${WORKER_PORT}`;

  return {
    async health(): Promise<WorkerHealth> {
      const response = await fetchWithTimeout(`${baseUrl}/health`);
      if (!response.ok) {
        throw new Error(`Failed to get health: ${response.statusText}`);
      }
      return response.json();
    },

    async listSessions(): Promise<IndexedSession[]> {
      const response = await fetchWithTimeout(`${baseUrl}/sessions`);
      if (!response.ok) {
        throw new Error(`Failed to list sessions: ${response.statusText}`);
      }
      const data = await response.json();
      return data.sessions;
    },

    async getSession(id: string): Promise<IndexedSession | null> {
      const response = await fetchWithTimeout(`${baseUrl}/sessions/${encodeURIComponent(id)}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Failed to get session: ${response.statusText}`);
      }
      const data = await response.json();
      return data.session;
    },

    async getMessages(
      id: string,
      opts: { limit?: number; offset?: number } = {}
    ): Promise<{ id: string; messages: Message[]; total: number }> {
      const params = new URLSearchParams();
      if (opts.limit !== undefined) params.set('limit', String(opts.limit));
      if (opts.offset !== undefined) params.set('offset', String(opts.offset));

      const url = `${baseUrl}/sessions/${encodeURIComponent(id)}/messages?${params}`;
      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        throw new Error(`Failed to get messages: ${response.statusText}`);
      }
      return response.json();
    },

    async deleteSession(id: string): Promise<{ success: boolean; error?: string }> {
      const response = await fetchWithTimeout(`${baseUrl}/sessions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return response.json();
    },
  };
}

export { WORKER_PORT };
