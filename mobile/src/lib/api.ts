import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import AsyncStorage from '@react-native-async-storage/async-storage'

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

export interface HostInfo {
  enabled: boolean
  hostname: string
  username: string
  homeDir: string
}

export const HOST_WORKSPACE_NAME = '@host'

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
    zen_token?: string
    model?: string
  }
  github?: {
    token?: string
  }
  claude_code?: {
    oauth_token?: string
    model?: string
  }
}

export interface ModelInfo {
  id: string
  name: string
  description?: string
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

export interface RecentSession {
  workspaceName: string
  sessionId: string
  agentType: AgentType
  lastAccessed: string
}

const DEFAULT_PORT = 7391
const STORAGE_KEY = 'perry_server_config'

interface ServerConfig {
  host: string
  port: number
}

let baseUrl = ''

export function setBaseUrl(url: string): void {
  baseUrl = url
}

export function getBaseUrl(): string {
  return baseUrl
}

export function isConfigured(): boolean {
  return baseUrl.length > 0
}

export async function loadServerConfig(): Promise<ServerConfig | null> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  const config = JSON.parse(stored) as ServerConfig
  baseUrl = `http://${config.host}:${config.port}`
  client = createClient()
  return config
}

export async function saveServerConfig(host: string, port: number = DEFAULT_PORT): Promise<void> {
  const config: ServerConfig = { host, port }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  baseUrl = `http://${host}:${port}`
  client = createClient()
}

export function getDefaultPort(): number {
  return DEFAULT_PORT
}

function createClient() {
  const link = new RPCLink({
    url: `${baseUrl}/rpc`,
  })

  return createORPCClient<{
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
      clone: (input: { sourceName: string; cloneName: string }) => Promise<WorkspaceInfo>
    }
    sessions: {
      list: (input: {
        workspaceName: string
        agentType?: AgentType
        limit?: number
        offset?: number
      }) => Promise<{ sessions: SessionInfo[]; total: number; hasMore: boolean }>
      listAll: (input: {
        agentType?: AgentType
        limit?: number
        offset?: number
      }) => Promise<{ sessions: (SessionInfo & { workspaceName: string })[]; total: number; hasMore: boolean }>
      get: (input: { workspaceName: string; sessionId: string; agentType?: AgentType; limit?: number; offset?: number }) => Promise<SessionDetail & { total: number; hasMore: boolean }>
      getRecent: (input: { limit?: number }) => Promise<{ sessions: RecentSession[] }>
      recordAccess: (input: { workspaceName: string; sessionId: string; agentType: AgentType }) => Promise<{ success: boolean }>
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
    }
    models: {
      list: (input: { agentType: 'claude-code' | 'opencode'; workspaceName?: string }) => Promise<{ models: ModelInfo[] }>
    }
  }>(link)
}

let client = createClient()

export function refreshClient(): void {
  client = createClient()
}

export interface SyncResult {
  synced: number
  failed: number
  results: { name: string; success: boolean; error?: string }[]
}

export interface SessionInfoWithWorkspace extends SessionInfo {
  workspaceName: string
}

export function getTerminalUrl(workspaceName: string): string {
  const wsUrl = baseUrl.replace(/^http/, 'ws')
  return `${wsUrl}/rpc/terminal/${encodeURIComponent(workspaceName)}`
}

export function getChatUrl(workspaceName: string, agentType: AgentType = 'claude-code'): string {
  const wsUrl = baseUrl.replace(/^http/, 'ws')
  const endpoint = agentType === 'opencode' ? 'opencode' : 'chat'
  return `${wsUrl}/rpc/${endpoint}/${encodeURIComponent(workspaceName)}`
}

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
  cloneWorkspace: (sourceName: string, cloneName: string) =>
    client.workspaces.clone({ sourceName, cloneName }),
  listSessions: (workspaceName: string, agentType?: AgentType, limit?: number, offset?: number) =>
    client.sessions.list({ workspaceName, agentType, limit, offset }),
  listAllSessions: (agentType?: AgentType, limit?: number, offset?: number) =>
    client.sessions.listAll({ agentType, limit, offset }),
  getSession: (workspaceName: string, sessionId: string, agentType?: AgentType, limit?: number, offset?: number) =>
    client.sessions.get({ workspaceName, sessionId, agentType, limit, offset }),
  getRecentSessions: (limit?: number) =>
    client.sessions.getRecent({ limit }),
  recordSessionAccess: (workspaceName: string, sessionId: string, agentType: AgentType) =>
    client.sessions.recordAccess({ workspaceName, sessionId, agentType }),
  getInfo: () => client.info(),
  getHostInfo: () => client.host.info(),
  updateHostAccess: (enabled: boolean) => client.host.updateAccess({ enabled }),
  getCredentials: () => client.config.credentials.get(),
  updateCredentials: (data: Credentials) => client.config.credentials.update(data),
  getScripts: () => client.config.scripts.get(),
  updateScripts: (data: Scripts) => client.config.scripts.update(data),
  getAgents: () => client.config.agents.get(),
  updateAgents: (data: CodingAgents) => client.config.agents.update(data),
  listModels: (agentType: 'claude-code' | 'opencode', workspaceName?: string) =>
    client.models.list({ agentType, workspaceName }),
}
