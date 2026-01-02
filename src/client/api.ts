import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import type { AppRouter } from '../agent/router';
import type { WorkspaceInfo, CreateWorkspaceRequest, InfoResponse } from '../shared/types';

export interface ApiClientOptions {
  baseUrl: string;
  timeout?: number;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

type Client = RouterClient<AppRouter>;

export class ApiClient {
  private baseUrl: string;
  private client: Client;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');

    const link = new RPCLink({
      url: `${this.baseUrl}/rpc`,
      fetch: (url, init) =>
        fetch(url, { ...init, signal: AbortSignal.timeout(options.timeout || 30000) }),
    });

    this.client = createORPCClient<Client>(link);
  }

  async health(): Promise<{ status: string; version: string }> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  async info(): Promise<InfoResponse> {
    try {
      return await this.client.info();
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    try {
      return await this.client.workspaces.list();
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async getWorkspace(name: string): Promise<WorkspaceInfo> {
    try {
      return await this.client.workspaces.get({ name });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async createWorkspace(request: CreateWorkspaceRequest): Promise<WorkspaceInfo> {
    try {
      return await this.client.workspaces.create(request);
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async deleteWorkspace(name: string): Promise<void> {
    try {
      await this.client.workspaces.delete({ name });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async startWorkspace(name: string): Promise<WorkspaceInfo> {
    try {
      return await this.client.workspaces.start({ name });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async stopWorkspace(name: string): Promise<WorkspaceInfo> {
    try {
      return await this.client.workspaces.stop({ name });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async getLogs(name: string, tail?: number): Promise<string> {
    try {
      return await this.client.workspaces.logs({ name, tail });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  getTerminalUrl(name: string): string {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws');
    return `${wsUrl}/rpc/terminal/${encodeURIComponent(name)}`;
  }

  private wrapError(err: unknown): ApiClientError {
    if (err instanceof ApiClientError) {
      return err;
    }

    if (err instanceof Error) {
      if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
        return new ApiClientError(
          `Cannot connect to agent at ${this.baseUrl}`,
          0,
          'CONNECTION_FAILED'
        );
      }
      if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
        return new ApiClientError('Request timed out', 0, 'TIMEOUT');
      }

      const orpcError = err as { code?: string; status?: number };
      if (orpcError.code) {
        return new ApiClientError(err.message, orpcError.status || 500, orpcError.code);
      }

      return new ApiClientError(err.message, 0, 'UNKNOWN');
    }

    return new ApiClientError('Unknown error', 0, 'UNKNOWN');
  }
}

export function createApiClient(worker: string, port?: number): ApiClient {
  let baseUrl: string;

  if (worker.includes('://')) {
    baseUrl = worker;
  } else if (worker.includes(':')) {
    baseUrl = `http://${worker}`;
  } else {
    const effectivePort = port || 7391;
    baseUrl = `http://${worker}:${effectivePort}`;
  }

  return new ApiClient({ baseUrl });
}
