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
} from './types'

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
    list: (input: {
      workspaceName: string
      agentType?: AgentType
      limit?: number
      offset?: number
    }) => Promise<{ sessions: SessionInfo[]; total: number; hasMore: boolean }>
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
  listSessions: (workspaceName: string, agentType?: AgentType, limit?: number, offset?: number) =>
    client.sessions.list({ workspaceName, agentType, limit, offset }),
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

export function getChatUrl(name: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/rpc/chat/${encodeURIComponent(name)}`
}
