import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { createDemoChatWebSocket } from './demo/chat'
import { demoDriver } from './demo/driver'
import { DEMO_TERMINAL_HTML } from './demo/terminal-html'
import { TERMINAL_HTML } from './terminal-html'

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
  agentSessionId?: string | null
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
  agentSessionId?: string | null
  messages: SessionMessage[]
}

export interface RecentSession {
  workspaceName: string
  sessionId: string
  agentType: AgentType
  lastAccessed: string
}

export interface GitHubRepo {
  name: string
  fullName: string
  cloneUrl: string
  sshUrl: string
  private: boolean
  description: string | null
  updatedAt: string
}

const DEFAULT_PORT = 7391
const STORAGE_KEY = 'perry_server_config'

type ServerMode = 'real' | 'demo'

interface ServerConfig {
  host: string
  port: number
  mode?: ServerMode
}

let baseUrl = ''
let serverMode: ServerMode = 'real'

export function setBaseUrl(url: string): void {
  baseUrl = url
}

export function getBaseUrl(): string {
  return baseUrl
}

export function isConfigured(): boolean {
  return baseUrl.length > 0
}

export function isDemoMode(): boolean {
  return serverMode === 'demo'
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase()
}

function resolveMode(host: string, storedMode?: ServerMode): ServerMode {
  if (storedMode) return storedMode
  return normalizeHost(host) === 'perry-demo' ? 'demo' : 'real'
}

export async function loadServerConfig(): Promise<ServerConfig | null> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY)
  if (!stored) return null

  const config = JSON.parse(stored) as ServerConfig
  const mode = resolveMode(config.host, config.mode)

  baseUrl = `http://${config.host}:${config.port}`
  client = createClient()
  setServerMode(mode)

  return { ...config, mode }
}

export async function saveServerConfig(host: string, port: number = DEFAULT_PORT): Promise<void> {
  const mode = resolveMode(host)
  const config: ServerConfig = { host, port, mode }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config))

  baseUrl = `http://${host}:${port}`
  client = createClient()
  setServerMode(mode)
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
      get: (input: {
        workspaceName: string
        sessionId: string
        agentType?: AgentType
        projectPath?: string
        limit?: number
        offset?: number
      }) => Promise<SessionDetail & { total: number; hasMore: boolean }>
      getRecent: (input: { limit?: number }) => Promise<{ sessions: RecentSession[] }>
      recordAccess: (input: { workspaceName: string; sessionId: string; agentType: AgentType }) => Promise<{ success: boolean }>
    }
    info: () => Promise<InfoResponse>
    host: {
      info: () => Promise<HostInfo>
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
    github: {
      listRepos: (input: { search?: string; perPage?: number; page?: number }) => Promise<{
        configured: boolean
        repos: GitHubRepo[]
        hasMore: boolean
      }>
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
  const endpoint = agentType === 'opencode' ? 'live/opencode' : 'live/claude'
  return `${wsUrl}/rpc/${endpoint}/${encodeURIComponent(workspaceName)}`
}

export function createChatWebSocket(workspaceName: string, agentType: AgentType): WebSocket {
  if (isDemoMode()) {
    return createDemoChatWebSocket({ workspaceName, agentType }) as unknown as WebSocket
  }

  return new WebSocket(getChatUrl(workspaceName, agentType))
}

export function getTerminalHtml(): string {
  return isDemoMode() ? DEMO_TERMINAL_HTML : TERMINAL_HTML
}

type ApiDriver = {
  listWorkspaces: () => Promise<WorkspaceInfo[]>
  getWorkspace: (name: string) => Promise<WorkspaceInfo>
  createWorkspace: (data: CreateWorkspaceRequest) => Promise<WorkspaceInfo>
  deleteWorkspace: (name: string) => Promise<{ success: boolean }>
  startWorkspace: (name: string, options?: { clone?: string; env?: Record<string, string> }) => Promise<WorkspaceInfo>
  stopWorkspace: (name: string) => Promise<WorkspaceInfo>
  getLogs: (name: string, tail?: number) => Promise<string>
  syncWorkspace: (name: string) => Promise<{ success: boolean }>
  syncAllWorkspaces: () => Promise<SyncResult>
  cloneWorkspace: (sourceName: string, cloneName: string) => Promise<WorkspaceInfo>

  listSessions: (workspaceName: string, agentType?: AgentType, limit?: number, offset?: number) => Promise<{ sessions: SessionInfo[]; total: number; hasMore: boolean }>
  listAllSessions: (agentType?: AgentType, limit?: number, offset?: number) => Promise<{ sessions: (SessionInfo & { workspaceName: string })[]; total: number; hasMore: boolean }>
  getSession: (workspaceName: string, sessionId: string, agentType?: AgentType, limit?: number, offset?: number, projectPath?: string) => Promise<SessionDetail & { total: number; hasMore: boolean }>
  getRecentSessions: (limit?: number) => Promise<{ sessions: RecentSession[] }>
  recordSessionAccess: (workspaceName: string, sessionId: string, agentType: AgentType) => Promise<{ success: boolean }>

  getInfo: () => Promise<InfoResponse>
  getHostInfo: () => Promise<HostInfo>

  getCredentials: () => Promise<Credentials>
  updateCredentials: (data: Credentials) => Promise<Credentials>
  getScripts: () => Promise<Scripts>
  updateScripts: (data: Scripts) => Promise<Scripts>
  getAgents: () => Promise<CodingAgents>
  updateAgents: (data: CodingAgents) => Promise<CodingAgents>

  listModels: (agentType: 'claude-code' | 'opencode', workspaceName?: string) => Promise<{ models: ModelInfo[] }>
  listGitHubRepos: (search?: string, perPage?: number, page?: number) => Promise<{ configured: boolean; repos: GitHubRepo[]; hasMore: boolean }>
}

const realDriver: ApiDriver = {
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
  cloneWorkspace: (sourceName: string, cloneName: string) => client.workspaces.clone({ sourceName, cloneName }),

  listSessions: (workspaceName: string, agentType?: AgentType, limit?: number, offset?: number) =>
    client.sessions.list({ workspaceName, agentType, limit, offset }),
  listAllSessions: (agentType?: AgentType, limit?: number, offset?: number) =>
    client.sessions.listAll({ agentType, limit, offset }),
  getSession: (workspaceName: string, sessionId: string, agentType?: AgentType, limit?: number, offset?: number, projectPath?: string) =>
    client.sessions.get({ workspaceName, sessionId, agentType, projectPath, limit, offset }),
  getRecentSessions: (limit?: number) => client.sessions.getRecent({ limit }),
  recordSessionAccess: (workspaceName: string, sessionId: string, agentType: AgentType) =>
    client.sessions.recordAccess({ workspaceName, sessionId, agentType }),

  getInfo: () => client.info(),
  getHostInfo: () => client.host.info(),

  getCredentials: () => client.config.credentials.get(),
  updateCredentials: (data: Credentials) => client.config.credentials.update(data),
  getScripts: () => client.config.scripts.get(),
  updateScripts: (data: Scripts) => client.config.scripts.update(data),
  getAgents: () => client.config.agents.get(),
  updateAgents: (data: CodingAgents) => client.config.agents.update(data),

  listModels: (agentType: 'claude-code' | 'opencode', workspaceName?: string) => client.models.list({ agentType, workspaceName }),
  listGitHubRepos: (search?: string, perPage?: number, page?: number) => client.github.listRepos({ search, perPage, page }),
}

const demoModeDriver: ApiDriver = {
  listWorkspaces: () => demoDriver.listWorkspaces(),
  getWorkspace: (name: string) => demoDriver.getWorkspace(name),
  createWorkspace: (data: CreateWorkspaceRequest) => demoDriver.createWorkspace(data),
  deleteWorkspace: (name: string) => demoDriver.deleteWorkspace(name),
  startWorkspace: (name: string, options?: { clone?: string; env?: Record<string, string> }) => demoDriver.startWorkspace(name, options),
  stopWorkspace: (name: string) => demoDriver.stopWorkspace(name),
  getLogs: (name: string, tail?: number) => demoDriver.getLogs(name, tail),
  syncWorkspace: (name: string) => demoDriver.syncWorkspace(name),
  syncAllWorkspaces: () => demoDriver.syncAllWorkspaces(),
  cloneWorkspace: (sourceName: string, cloneName: string) => demoDriver.cloneWorkspace(sourceName, cloneName),

  listSessions: (workspaceName: string, agentType?: AgentType, limit?: number, offset?: number) =>
    demoDriver.listSessions(workspaceName, agentType, limit, offset),
  listAllSessions: (agentType?: AgentType, limit?: number, offset?: number) => demoDriver.listAllSessions(agentType, limit, offset),
  getSession: (workspaceName: string, sessionId: string, agentType?: AgentType, limit?: number, offset?: number, projectPath?: string) =>
    demoDriver.getSession(workspaceName, sessionId, agentType, limit, offset, projectPath),
  getRecentSessions: (limit?: number) => demoDriver.getRecentSessions(limit),
  recordSessionAccess: (workspaceName: string, sessionId: string, agentType: AgentType) =>
    demoDriver.recordSessionAccess(workspaceName, sessionId, agentType),

  getInfo: () => demoDriver.getInfo(),
  getHostInfo: () => demoDriver.getHostInfo(),

  getCredentials: () => demoDriver.getCredentials(),
  updateCredentials: (data: Credentials) => demoDriver.updateCredentials(data),
  getScripts: () => demoDriver.getScripts(),
  updateScripts: (data: Scripts) => demoDriver.updateScripts(data),
  getAgents: () => demoDriver.getAgents(),
  updateAgents: (data: CodingAgents) => demoDriver.updateAgents(data),

  listModels: (agentType: 'claude-code' | 'opencode', workspaceName?: string) => demoDriver.listModels(agentType, workspaceName),
  listGitHubRepos: (search?: string, perPage?: number, page?: number) => demoDriver.listGitHubRepos(search, perPage, page),
}

let driver: ApiDriver = realDriver

function setServerMode(mode: ServerMode): void {
  serverMode = mode
  driver = mode === 'demo' ? demoModeDriver : realDriver
}

export const api = {
  listWorkspaces: (...args: Parameters<ApiDriver['listWorkspaces']>) => driver.listWorkspaces(...args),
  getWorkspace: (...args: Parameters<ApiDriver['getWorkspace']>) => driver.getWorkspace(...args),
  createWorkspace: (...args: Parameters<ApiDriver['createWorkspace']>) => driver.createWorkspace(...args),
  deleteWorkspace: (...args: Parameters<ApiDriver['deleteWorkspace']>) => driver.deleteWorkspace(...args),
  startWorkspace: (...args: Parameters<ApiDriver['startWorkspace']>) => driver.startWorkspace(...args),
  stopWorkspace: (...args: Parameters<ApiDriver['stopWorkspace']>) => driver.stopWorkspace(...args),
  getLogs: (...args: Parameters<ApiDriver['getLogs']>) => driver.getLogs(...args),
  syncWorkspace: (...args: Parameters<ApiDriver['syncWorkspace']>) => driver.syncWorkspace(...args),
  syncAllWorkspaces: (...args: Parameters<ApiDriver['syncAllWorkspaces']>) => driver.syncAllWorkspaces(...args),
  cloneWorkspace: (...args: Parameters<ApiDriver['cloneWorkspace']>) => driver.cloneWorkspace(...args),

  listSessions: (...args: Parameters<ApiDriver['listSessions']>) => driver.listSessions(...args),
  listAllSessions: (...args: Parameters<ApiDriver['listAllSessions']>) => driver.listAllSessions(...args),
  getSession: (...args: Parameters<ApiDriver['getSession']>) => driver.getSession(...args),
  getRecentSessions: (...args: Parameters<ApiDriver['getRecentSessions']>) => driver.getRecentSessions(...args),
  recordSessionAccess: (...args: Parameters<ApiDriver['recordSessionAccess']>) => driver.recordSessionAccess(...args),

  getInfo: (...args: Parameters<ApiDriver['getInfo']>) => driver.getInfo(...args),
  getHostInfo: (...args: Parameters<ApiDriver['getHostInfo']>) => driver.getHostInfo(...args),

  getCredentials: (...args: Parameters<ApiDriver['getCredentials']>) => driver.getCredentials(...args),
  updateCredentials: (...args: Parameters<ApiDriver['updateCredentials']>) => driver.updateCredentials(...args),
  getScripts: (...args: Parameters<ApiDriver['getScripts']>) => driver.getScripts(...args),
  updateScripts: (...args: Parameters<ApiDriver['updateScripts']>) => driver.updateScripts(...args),
  getAgents: (...args: Parameters<ApiDriver['getAgents']>) => driver.getAgents(...args),
  updateAgents: (...args: Parameters<ApiDriver['updateAgents']>) => driver.updateAgents(...args),

  listModels: (...args: Parameters<ApiDriver['listModels']>) => driver.listModels(...args),
  listGitHubRepos: (...args: Parameters<ApiDriver['listGitHubRepos']>) => driver.listGitHubRepos(...args),
}
