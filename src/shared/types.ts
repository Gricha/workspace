export interface WorkspaceCredentials {
  env: Record<string, string>;
  /**
   * File or directory mappings from host to workspace.
   * Key is destination path (in workspace), value is source path (on host).
   * Paths starting with ~/ are expanded to the home directory.
   * Directories are copied recursively via TAR.
   * Example: { "~/.ssh/id_rsa": "~/.ssh/id_rsa", "~/.config/myapp": "~/.config/myapp" }
   */
  files: Record<string, string>;
}

export interface WorkspaceScripts {
  post_start?: string[];
  fail_on_error?: boolean;
}

export interface CodingAgents {
  opencode?: {
    zen_token?: string;
    model?: string;
  };
  github?: {
    token?: string;
  };
  claude_code?: {
    oauth_token?: string;
    model?: string;
  };
}

export interface SSHKeyConfig {
  copy: string[];
  authorize: string[];
}

export interface SSHSettings {
  autoAuthorizeHostKeys: boolean;
  global: SSHKeyConfig;
  workspaces: Record<string, Partial<SSHKeyConfig>>;
}

export interface TerminalSettings {
  preferredShell?: string;
}

export interface AgentConfig {
  port: number;
  credentials: WorkspaceCredentials;
  scripts: WorkspaceScripts;
  agents?: CodingAgents;
  allowHostAccess?: boolean;
  ssh?: SSHSettings;
  terminal?: TerminalSettings;
}

export interface ClientConfig {
  worker: string;
}

export type WorkspaceStatus = 'running' | 'stopped' | 'creating' | 'error';

export interface PortMapping {
  host: number;
  container: number;
}

export interface WorkspacePorts {
  ssh: number;
  http?: number;
  forwards?: PortMapping[];
}

export interface WorkspaceInfo {
  name: string;
  status: WorkspaceStatus;
  containerId: string;
  created: string;
  repo?: string;
  ports: WorkspacePorts;
  lastUsed?: string;
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

export interface TailscaleInfo {
  running: boolean;
  dnsName?: string;
  serveActive: boolean;
  httpsUrl?: string;
}

export interface InfoResponse {
  hostname: string;
  uptime: number;
  workspacesCount: number;
  dockerVersion: string;
  terminalConnections: number;
  tailscale?: TailscaleInfo;
}

export const DEFAULT_CONFIG_DIR =
  process.env.PERRY_CONFIG_DIR || `${process.env.HOME}/.config/perry`;
export const STATE_FILE = 'state.json';
export const CONFIG_FILE = 'config.json';
export const CLIENT_CONFIG_FILE = 'client.json';
