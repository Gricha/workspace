export interface WorkspaceInfo {
  name: string;
  status: 'running' | 'stopped' | 'creating' | 'error';
  containerId: string;
  created: string;
  repo?: string;
  ports: {
    ssh: number;
    http?: number;
    forwards?: number[];
  };
  lastUsed?: string;
}

export interface RecentSession {
  workspaceName: string;
  sessionId: string;
  agentType: 'claude-code' | 'opencode' | 'codex';
  lastAccessed: string;
}

export interface InfoResponse {
  hostname: string;
  uptime: number;
  workspacesCount: number;
  dockerVersion: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  clone?: string;
}

export interface Credentials {
  env: Record<string, string>;
  files: Record<string, string>;
}

export interface Scripts {
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

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

export type AgentType = 'claude-code' | 'opencode' | 'codex';

export interface SessionInfo {
  id: string;
  name: string | null;
  agentType: AgentType;
  agentSessionId?: string | null;
  projectPath: string;
  messageCount: number;
  lastActivity: string;
  firstPrompt: string | null;
}

export interface SessionInfoWithWorkspace extends SessionInfo {
  workspaceName: string;
}

export interface SessionMessage {
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result';
  content: string | null;
  timestamp: string | null;
  toolName?: string;
  toolId?: string;
  toolInput?: string;
}

export interface SessionDetail {
  id: string;
  agentType?: AgentType;
  agentSessionId?: string | null;
  messages: SessionMessage[];
}

export const HOST_WORKSPACE_NAME = '@host';

export interface HostInfo {
  enabled: boolean;
  hostname: string;
  username: string;
  homeDir: string;
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

export interface SSHKeyInfo {
  name: string;
  path: string;
  publicKeyPath: string;
  type: 'ed25519' | 'rsa' | 'ecdsa' | 'dsa' | 'unknown';
  fingerprint: string;
  hasPrivateKey: boolean;
}

export interface TerminalSettings {
  preferredShell?: string;
  detectedShell?: string;
}
