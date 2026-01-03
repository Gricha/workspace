import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'

export interface WorkspaceInfo {
  name: string
  status: 'running' | 'stopped' | 'creating' | 'error'
  containerId: string
  created: string
  repo?: string
  ports: {
    ssh: number
    http?: number
  }
}

export interface InfoResponse {
  hostname: string
  uptime: number
  workspacesCount: number
  dockerVersion: string
}

export interface CreateWorkspaceRequest {
  name: string
  clone?: string
}

export interface Credentials {
  env: Record<string, string>
  files: Record<string, string>
}

export interface Scripts {
  post_start?: string
}

export interface CodingAgents {
  opencode?: {
    api_key?: string
    api_base_url?: string
  }
  github?: {
    token?: string
  }
  claude_code?: {
    oauth_token?: string
    credentials_path?: string
  }
}

export type AgentType = 'claude-code' | 'opencode' | 'codex'

export interface SessionInfo {
  id: string
  name: string | null
  agentType: AgentType
  projectPath: string
  messageCount: number
  lastActivity: string
  firstPrompt: string | null
}

export interface SessionMessage {
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result'
  content: string | null
  timestamp: string | null
  toolName?: string
  toolId?: string
  toolInput?: string
}

export interface SessionDetail {
  id: string
  agentType?: AgentType
  messages: SessionMessage[]
}

function getRpcUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/rpc`
  }
  return '/rpc'
}

const link = new RPCLink({
  url: getRpcUrl(),
})

const client = createORPCClient<{
  workspaces: {
    list: () => Promise<WorkspaceInfo[]>
    get: (input: { name: string }) => Promise<WorkspaceInfo>
    create: (input: CreateWorkspaceRequest) => Promise<WorkspaceInfo>
    delete: (input: { name: string }) => Promise<{ success: boolean }>
    start: (input: { name: string }) => Promise<WorkspaceInfo>
    stop: (input: { name: string }) => Promise<WorkspaceInfo>
    logs: (input: { name: string; tail?: number }) => Promise<string>
  }
  sessions: {
    list: (input: { workspaceName: string; agentType?: AgentType }) => Promise<{ sessions: SessionInfo[] }>
    get: (input: { workspaceName: string; sessionId: string; agentType?: AgentType }) => Promise<SessionDetail>
  }
  info: () => Promise<InfoResponse>
  config: {
    credentials: {
      get: () => Promise<Credentials>
      update: (input: Credentials) => Promise<Credentials>
    }
    scripts: {
      get: () => Promise<Scripts>
      update: (input: Scripts) => Promise<Scripts>
    }
    agents: {
      get: () => Promise<CodingAgents>
      update: (input: CodingAgents) => Promise<CodingAgents>
    }
  }
}>(link)

export const api = {
  listWorkspaces: () => client.workspaces.list(),
  getWorkspace: (name: string) => client.workspaces.get({ name }),
  createWorkspace: (data: CreateWorkspaceRequest) => client.workspaces.create(data),
  deleteWorkspace: (name: string) => client.workspaces.delete({ name }),
  startWorkspace: (name: string) => client.workspaces.start({ name }),
  stopWorkspace: (name: string) => client.workspaces.stop({ name }),
  getLogs: (name: string, tail = 100) => client.workspaces.logs({ name, tail }),
  listSessions: (workspaceName: string, agentType?: AgentType) =>
    client.sessions.list({ workspaceName, agentType }),
  getSession: (workspaceName: string, sessionId: string, agentType?: AgentType) =>
    client.sessions.get({ workspaceName, sessionId, agentType }),
  getInfo: () => client.info(),
  getCredentials: () => client.config.credentials.get(),
  updateCredentials: (data: Credentials) => client.config.credentials.update(data),
  getScripts: () => client.config.scripts.get(),
  updateScripts: (data: Scripts) => client.config.scripts.update(data),
  getAgents: () => client.config.agents.get(),
  updateAgents: (data: CodingAgents) => client.config.agents.update(data),
}

export function getTerminalUrl(name: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/rpc/terminal/${encodeURIComponent(name)}`
}
