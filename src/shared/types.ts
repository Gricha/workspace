export interface WorkspaceCredentials {
  env: Record<string, string>;
  files: Record<string, string>;
}

export interface WorkspaceScripts {
  post_start?: string;
}

export interface CodingAgents {
  opencode?: {
    api_key?: string;
  };
  github?: {
    token?: string;
  };
  claude_code?: {
    oauth_token?: string;
    connected_at?: string;
  };
}

export interface AgentConfig {
  port: number;
  credentials: WorkspaceCredentials;
  scripts: WorkspaceScripts;
  agents?: CodingAgents;
}

export interface ClientConfig {
  worker: string;
}

export type WorkspaceStatus = 'running' | 'stopped' | 'creating' | 'error';

export interface WorkspacePorts {
  ssh: number;
  http?: number;
}

export interface WorkspaceInfo {
  name: string;
  status: WorkspaceStatus;
  containerId: string;
  created: string;
  repo?: string;
  ports: WorkspacePorts;
}

export interface WorkspaceState {
  workspaces: Record<string, WorkspaceInfo>;
}

export interface CreateWorkspaceRequest {
  name: string;
  clone?: string;
  env?: Record<string, string>;
}

export interface ApiError {
  error: string;
  code?: string;
}

export interface HealthResponse {
  status: string;
  version: string;
}

export interface InfoResponse {
  hostname: string;
  uptime: number;
  workspacesCount: number;
  dockerVersion: string;
  terminalConnections: number;
}

export const DEFAULT_PORT = 7391;
export const DEFAULT_CONFIG_DIR =
  process.env.WS_CONFIG_DIR || `${process.env.HOME}/.config/workspace`;
export const STATE_FILE = 'state.json';
export const CONFIG_FILE = 'config.json';
export const CLIENT_CONFIG_FILE = 'client.json';
