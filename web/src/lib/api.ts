import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type {
  WorkspaceInfo,
  InfoResponse,
  CreateWorkspaceRequest,
  Credentials,
  Scripts,
  CodingAgents,
  AgentType,
  SessionInfo,
  SessionMessage,
  SessionDetail,
  HostInfo,
  SSHSettings,
  SSHKeyInfo,
  RecentSession,
  ModelInfo,
} from '@shared/client-types'

export type {
  WorkspaceInfo,
  InfoResponse,
  CreateWorkspaceRequest,
  Credentials,
  Scripts,
  CodingAgents,
  AgentType,
  SessionInfo,
  SessionMessage,
  SessionDetail,
  HostInfo,
  SSHSettings,
  SSHKeyInfo,
  RecentSession,
  ModelInfo,
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
    start: (input: { name: string; clone?: string; env?: Record<string, string> }) => Promise<WorkspaceInfo>
    stop: (input: { name: string }) => Promise<WorkspaceInfo>
    logs: (input: { name: string; tail?: number }) => Promise<string>
    sync: (input: { name: string }) => Promise<{ success: boolean }>
    syncAll: () => Promise<{ synced: number; failed: number; results: { name: string; success: boolean; error?: string }[] }>
    touch: (input: { name: string }) => Promise<WorkspaceInfo>
    getPortForwards: (input: { name: string }) => Promise<{ forwards: number[] }>
    setPortForwards: (input: { name: string; forwards: number[] }) => Promise<WorkspaceInfo>
    clone: (input: { sourceName: string; cloneName: string }) => Promise<WorkspaceInfo>
  }
  sessions: {
    list: (input: {
      workspaceName: string
      agentType?: AgentType
      limit?: number
      offset?: number
    }) => Promise<{ sessions: SessionInfo[]; total: number; hasMore: boolean }>
    get: (input: { workspaceName: string; sessionId: string; agentType?: AgentType; limit?: number; offset?: number }) => Promise<SessionDetail & { total: number; hasMore: boolean }>
    rename: (input: { workspaceName: string; sessionId: string; name: string }) => Promise<{ success: boolean }>
    clearName: (input: { workspaceName: string; sessionId: string }) => Promise<{ success: boolean }>
    getRecent: (input: { limit?: number }) => Promise<{ sessions: RecentSession[] }>
    recordAccess: (input: { workspaceName: string; sessionId: string; agentType: AgentType }) => Promise<{ success: boolean }>
    delete: (input: { workspaceName: string; sessionId: string; agentType: AgentType }) => Promise<{ success: boolean }>
    search: (input: { workspaceName: string; query: string }) => Promise<{ results: Array<{ sessionId: string; agentType: AgentType; matchCount: number }> }>
  }
  models: {
    list: (input: { agentType: 'claude-code' | 'opencode'; workspaceName?: string }) => Promise<{ models: ModelInfo[] }>
  }
  info: () => Promise<InfoResponse>
  host: {
    info: () => Promise<HostInfo>
    updateAccess: (input: { enabled: boolean }) => Promise<HostInfo>
  }
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
    ssh: {
      get: () => Promise<SSHSettings>
      update: (input: SSHSettings) => Promise<SSHSettings>
      listKeys: () => Promise<SSHKeyInfo[]>
    }
  }
}>(link)

export const api = {
  listWorkspaces: () => client.workspaces.list(),
  getWorkspace: (name: string) => client.workspaces.get({ name }),
  createWorkspace: (data: CreateWorkspaceRequest) => client.workspaces.create(data),
  deleteWorkspace: (name: string) => client.workspaces.delete({ name }),
  startWorkspace: (name: string, options?: { clone?: string; env?: Record<string, string> }) =>
    client.workspaces.start({ name, clone: options?.clone, env: options?.env }),
  stopWorkspace: (name: string) => client.workspaces.stop({ name }),
  getLogs: (name: string, tail = 100) => client.workspaces.logs({ name, tail }),
  syncWorkspace: (name: string) => client.workspaces.sync({ name }),
  syncAllWorkspaces: () => client.workspaces.syncAll(),
  touchWorkspace: (name: string) => client.workspaces.touch({ name }),
  getPortForwards: (name: string) => client.workspaces.getPortForwards({ name }),
  setPortForwards: (name: string, forwards: number[]) => client.workspaces.setPortForwards({ name, forwards }),
  cloneWorkspace: (sourceName: string, cloneName: string) =>
    client.workspaces.clone({ sourceName, cloneName }),
  listSessions: (workspaceName: string, agentType?: AgentType, limit?: number, offset?: number) =>
    client.sessions.list({ workspaceName, agentType, limit, offset }),
  getRecentSessions: (limit?: number) => client.sessions.getRecent({ limit }),
  recordSessionAccess: (workspaceName: string, sessionId: string, agentType: AgentType) =>
    client.sessions.recordAccess({ workspaceName, sessionId, agentType }),
  getSession: (workspaceName: string, sessionId: string, agentType?: AgentType, limit?: number, offset?: number) =>
    client.sessions.get({ workspaceName, sessionId, agentType, limit, offset }),
  renameSession: (workspaceName: string, sessionId: string, name: string) =>
    client.sessions.rename({ workspaceName, sessionId, name }),
  clearSessionName: (workspaceName: string, sessionId: string) =>
    client.sessions.clearName({ workspaceName, sessionId }),
  deleteSession: (workspaceName: string, sessionId: string, agentType: AgentType) =>
    client.sessions.delete({ workspaceName, sessionId, agentType }),
  searchSessions: (workspaceName: string, query: string) =>
    client.sessions.search({ workspaceName, query }),
  getInfo: () => client.info(),
  getCredentials: () => client.config.credentials.get(),
  updateCredentials: (data: Credentials) => client.config.credentials.update(data),
  getScripts: () => client.config.scripts.get(),
  updateScripts: (data: Scripts) => client.config.scripts.update(data),
  getAgents: () => client.config.agents.get(),
  updateAgents: (data: CodingAgents) => client.config.agents.update(data),
  getHostInfo: () => client.host.info(),
  updateHostAccess: (enabled: boolean) => client.host.updateAccess({ enabled }),
  getSSHSettings: () => client.config.ssh.get(),
  updateSSHSettings: (data: SSHSettings) => client.config.ssh.update(data),
  listSSHKeys: () => client.config.ssh.listKeys(),
  listModels: (agentType: 'claude-code' | 'opencode', workspaceName?: string) =>
    client.models.list({ agentType, workspaceName }),
}

export function getTerminalUrl(name: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/rpc/terminal/${encodeURIComponent(name)}`
}

export function getChatUrl(name: string, agentType: AgentType = 'claude-code'): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const endpoint = agentType === 'opencode' ? 'opencode' : 'chat'
  return `${protocol}//${window.location.host}/rpc/${endpoint}/${encodeURIComponent(name)}`
}
