import type {
  AgentType,
  CodingAgents,
  Credentials,
  CreateWorkspaceRequest,
  GitHubRepo,
  HostInfo,
  InfoResponse,
  ModelInfo,
  RecentSession,
  Scripts,
  SessionDetail,
  SessionInfo,
  WorkspaceInfo,
} from '../api'

import {
  demoAgents,
  demoCredentials,
  demoGitHubRepos,
  demoHostInfo,
  demoInfo,
  demoModelsByAgent,
  demoRecentSessions,
  demoSessionDetails,
  demoSessions,
  demoWorkspaces,
} from './data'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(16).slice(2)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

type ListSessionsResponse = { sessions: SessionInfo[]; total: number; hasMore: boolean }

type ListAllSessionsResponse = {
  sessions: Array<SessionInfo & { workspaceName: string }>
  total: number
  hasMore: boolean
}

type GetSessionResponse = SessionDetail & { total: number; hasMore: boolean }

type ListModelsResponse = { models: ModelInfo[] }

type ListGitHubReposResponse = { configured: boolean; repos: GitHubRepo[]; hasMore: boolean }

type GetRecentSessionsResponse = { sessions: RecentSession[] }

export class DemoApiDriver {
  private info: InfoResponse = clone(demoInfo)
  private hostInfo: HostInfo = clone(demoHostInfo)

  private workspaces = new Map<string, WorkspaceInfo>(clone(demoWorkspaces).map(w => [w.name, w]))
  private sessions = new Map<string, SessionInfo[]>(Object.entries(clone(demoSessions)))
  private sessionDetails = clone(demoSessionDetails)
  private recentSessions: RecentSession[] = clone(demoRecentSessions.sessions)

  private credentials: Credentials = clone(demoCredentials)
  private scripts: Scripts = clone({ post_start: 'bun install' })
  private agents: CodingAgents = clone(demoAgents)

  getInfo = async (): Promise<InfoResponse> => {
    return { ...this.info, workspacesCount: this.workspaces.size }
  }

  getHostInfo = async (): Promise<HostInfo> => {
    return this.hostInfo
  }

  listWorkspaces = async (): Promise<WorkspaceInfo[]> => {
    return [...this.workspaces.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  getWorkspace = async (name: string): Promise<WorkspaceInfo> => {
    const workspace = this.workspaces.get(name)
    if (!workspace) throw new Error(`Workspace not found: ${name}`)
    return workspace
  }

  createWorkspace = async (data: CreateWorkspaceRequest): Promise<WorkspaceInfo> => {
    const name = data.name.trim()
    if (!name) throw new Error('Workspace name is required')
    if (this.workspaces.has(name)) throw new Error(`Workspace already exists: ${name}`)

    const workspace: WorkspaceInfo = {
      name,
      status: 'creating',
      containerId: randomId(`workspace-${name}`),
      created: nowIso(),
      repo: data.clone,
      ports: { ssh: 2222 + this.workspaces.size },
    }

    this.workspaces.set(name, workspace)
    this.sessions.set(name, [])

    setTimeout(() => {
      const current = this.workspaces.get(name)
      if (!current || current.status !== 'creating') return
      this.workspaces.set(name, { ...current, status: 'running' })
    }, 1200)

    return workspace
  }

  deleteWorkspace = async (name: string): Promise<{ success: boolean }> => {
    this.workspaces.delete(name)
    this.sessions.delete(name)
    delete this.sessionDetails[name]
    this.recentSessions = this.recentSessions.filter(s => s.workspaceName !== name)
    return { success: true }
  }

  startWorkspace = async (name: string, _options?: { clone?: string; env?: Record<string, string> }): Promise<WorkspaceInfo> => {
    const workspace = await this.getWorkspace(name)
    const updated: WorkspaceInfo = { ...workspace, status: 'running' }
    this.workspaces.set(updated.name, updated)
    return updated
  }

  stopWorkspace = async (name: string): Promise<WorkspaceInfo> => {
    const workspace = await this.getWorkspace(name)
    const updated: WorkspaceInfo = { ...workspace, status: 'stopped' }
    this.workspaces.set(updated.name, updated)
    return updated
  }

  getLogs = async (_name: string, tail = 100): Promise<string> => {
    const lines = ['demo: workspace starting', 'demo: installing dependencies', 'demo: ready']
    return lines.slice(Math.max(0, lines.length - tail)).join('\n')
  }

  syncWorkspace = async (_name: string): Promise<{ success: boolean }> => {
    return { success: true }
  }

  syncAllWorkspaces = async (): Promise<{ synced: number; failed: number; results: { name: string; success: boolean; error?: string }[] }> => {
    const results = [...this.workspaces.keys()].map(name => ({ name, success: true }))
    return { synced: results.length, failed: 0, results }
  }

  cloneWorkspace = async (sourceName: string, cloneName: string): Promise<WorkspaceInfo> => {
    const source = await this.getWorkspace(sourceName)
    const name = cloneName.trim()
    if (!name) throw new Error('Clone name is required')
    if (this.workspaces.has(name)) throw new Error(`Workspace already exists: ${name}`)

    const workspace: WorkspaceInfo = {
      ...source,
      name,
      status: 'stopped',
      containerId: randomId(`workspace-${name}`),
      created: nowIso(),
    }

    this.workspaces.set(name, workspace)
    this.sessions.set(name, [])

    return workspace
  }

  listSessions = async (workspaceName: string, agentType?: AgentType, limit = 50, offset = 0): Promise<ListSessionsResponse> => {
    const all = this.sessions.get(workspaceName) ?? []
    const filtered = agentType ? all.filter(s => s.agentType === agentType) : all

    return {
      sessions: filtered.slice(offset, offset + limit),
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
    }
  }

  listAllSessions = async (agentType?: AgentType, limit = 50, offset = 0): Promise<ListAllSessionsResponse> => {
    const all = [...this.sessions.entries()].flatMap(([workspaceName, sessions]) =>
      sessions.map(s => ({ ...s, workspaceName }))
    )

    const filtered = agentType ? all.filter(s => s.agentType === agentType) : all

    return {
      sessions: filtered.slice(offset, offset + limit),
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
    }
  }

  getSession = async (
    workspaceName: string,
    sessionId: string,
    _agentType?: AgentType,
    limit?: number,
    offset?: number,
    _projectPath?: string
  ): Promise<GetSessionResponse> => {
    const detail = this.sessionDetails[workspaceName]?.[sessionId]
    if (!detail) {
      return { id: sessionId, messages: [], total: 0, hasMore: false }
    }

    const actualLimit = limit ?? detail.messages.length
    const actualOffset = offset ?? 0

    return {
      ...detail,
      messages: detail.messages.slice(actualOffset, actualOffset + actualLimit),
      total: detail.total,
      hasMore: actualOffset + actualLimit < detail.total,
    }
  }

  getRecentSessions = async (limit = 20): Promise<GetRecentSessionsResponse> => {
    return { sessions: this.recentSessions.slice(0, limit) }
  }

  recordSessionAccess = async (workspaceName: string, sessionId: string, agentType: AgentType): Promise<{ success: boolean }> => {
    const existing = this.recentSessions.find(s => s.workspaceName === workspaceName && s.sessionId === sessionId)
    const entry: RecentSession = {
      workspaceName,
      sessionId,
      agentType,
      lastAccessed: nowIso(),
    }

    if (existing) {
      this.recentSessions = [entry, ...this.recentSessions.filter(s => s !== existing)]
    } else {
      this.recentSessions = [entry, ...this.recentSessions]
    }

    return { success: true }
  }

  getCredentials = async (): Promise<Credentials> => {
    return this.credentials
  }

  updateCredentials = async (input: Credentials): Promise<Credentials> => {
    this.credentials = clone(input)
    return this.credentials
  }

  getScripts = async (): Promise<Scripts> => {
    return this.scripts
  }

  updateScripts = async (input: Scripts): Promise<Scripts> => {
    this.scripts = clone(input)
    return this.scripts
  }

  getAgents = async (): Promise<CodingAgents> => {
    return this.agents
  }

  updateAgents = async (input: CodingAgents): Promise<CodingAgents> => {
    this.agents = clone(input)
    return this.agents
  }

  listModels = async (agentType: 'claude-code' | 'opencode', _workspaceName?: string): Promise<ListModelsResponse> => {
    return { models: demoModelsByAgent[agentType] ?? [] }
  }

  listGitHubRepos = async (_search?: string, _perPage?: number, _page?: number): Promise<ListGitHubReposResponse> => {
    return demoGitHubRepos
  }
}

export const demoDriver = new DemoApiDriver()
