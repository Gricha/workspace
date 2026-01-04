export interface WorkspaceInfo {
  name: string;
  status: 'running' | 'stopped' | 'creating' | 'error';
  containerId: string;
  created: string;
  repo?: string;
  ports: {
    ssh: number;
    http?: number;
  };
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
  post_start?: string;
}

export interface CodingAgents {
  opencode?: {
    api_key?: string;
    api_base_url?: string;
  };
  github?: {
    token?: string;
  };
  claude_code?: {
    oauth_token?: string;
  };
}

export type AgentType = 'claude-code' | 'opencode' | 'codex';

export interface SessionInfo {
  id: string;
  name: string | null;
  agentType: AgentType;
  projectPath: string;
  messageCount: number;
  lastActivity: string;
  firstPrompt: string | null;
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
  messages: SessionMessage[];
}
