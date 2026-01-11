import type {
  AgentType,
  CodingAgents,
  Credentials,
  GitHubRepo,
  HostInfo,
  InfoResponse,
  ModelInfo,
  RecentSession,
  Scripts,
  SessionDetail,
  SessionInfo,
  SessionMessage,
  WorkspaceInfo,
} from '../api'

const now = () => new Date().toISOString()

export const demoInfo: InfoResponse = {
  hostname: 'perry-demo',
  uptime: 60 * 60 * 4 + 32 * 60,
  workspacesCount: 2,
  dockerVersion: '25.0.3',
}

// Keep this disabled so the "Host Machine" row doesn’t appear.
export const demoHostInfo: HostInfo = {
  enabled: false,
  hostname: 'perry-demo',
  username: 'demo',
  homeDir: '/home/demo',
}

export const demoWorkspaces: WorkspaceInfo[] = [
  {
    name: 'demo-project',
    status: 'running',
    containerId: 'demo-project-abcdef123456',
    created: now(),
    repo: 'https://github.com/gricha/perry-demo',
    ports: { ssh: 2222, http: 3000 },
  },
  {
    name: 'experiment',
    status: 'stopped',
    containerId: 'experiment-abcdef123456',
    created: now(),
    repo: 'https://github.com/gricha/perry-experiment',
    ports: { ssh: 2223 },
  },
]

export const demoModelsByAgent: Record<'claude-code' | 'opencode', ModelInfo[]> = {
  'claude-code': [
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Sonnet 4',
      description: 'Fast and reliable',
    },
    {
      id: 'claude-opus-4-20250514',
      name: 'Opus 4',
      description: 'Most capable',
    },
  ],
  opencode: [
    {
      id: 'gpt-5',
      name: 'GPT-5',
      description: 'General purpose coding assistant',
    },
  ],
}

export const demoAgents: CodingAgents = {
  opencode: {
    model: 'gpt-5',
  },
  claude_code: {
    model: 'claude-sonnet-4-20250514',
  },
}

export const demoCredentials: Credentials = {
  env: {
    NODE_ENV: 'development',
  },
  files: {},
}

export const demoScripts: Scripts = {
  post_start: 'bun install',
}

export const demoGitHubRepos: { configured: boolean; repos: GitHubRepo[]; hasMore: boolean } = {
  configured: false,
  repos: [],
  hasMore: false,
}

function sessionMessage(type: SessionMessage['type'], content: string, extras?: Partial<SessionMessage>): SessionMessage {
  return {
    type,
    content,
    timestamp: now(),
    ...extras,
  }
}

export const demoSessions: Record<string, SessionInfo[]> = {
  'demo-project': [
    {
      id: 'demo-session-1',
      name: 'Fix flaky tests',
      agentType: 'claude-code',
      projectPath: '/home/demo/demo-project',
      messageCount: 14,
      lastActivity: now(),
      firstPrompt: 'Can you make the tests less flaky?',
    },
    {
      id: 'demo-session-2',
      name: 'Add new endpoint',
      agentType: 'opencode',
      projectPath: '/home/demo/demo-project',
      messageCount: 9,
      lastActivity: now(),
      firstPrompt: 'Add a health check endpoint',
    },
  ],
  experiment: [
    {
      id: 'demo-session-3',
      name: 'Spike ideas',
      agentType: 'claude-code',
      projectPath: '/home/demo/experiment',
      messageCount: 4,
      lastActivity: now(),
      firstPrompt: 'Brainstorm feature ideas',
    },
  ],
}

export const demoSessionDetails: Record<string, Record<string, SessionDetail & { total: number; hasMore: boolean }>> = {
  'demo-project': {
    'demo-session-1': {
      id: 'demo-session-1',
      agentType: 'claude-code',
      total: 14,
      hasMore: false,
      messages: [
        sessionMessage('user', 'Can you make the tests less flaky?'),
        sessionMessage('assistant', 'Sure. I will first look at the existing test setup.'),
        sessionMessage('tool_use', 'Glob', { toolName: 'Glob', toolId: '1', toolInput: '{"pattern":"**/*.test.ts"}' }),
        sessionMessage('tool_result', 'Found 3 test files.', { toolId: '1' }),
        sessionMessage('assistant', 'The flakiness looks timing-related; I will add deterministic waits.'),
      ],
    },
    'demo-session-2': {
      id: 'demo-session-2',
      agentType: 'opencode',
      total: 9,
      hasMore: false,
      messages: [
        sessionMessage('user', 'Add a health check endpoint'),
        sessionMessage('assistant', 'Ok. I will add `/healthz` and a basic response payload.'),
      ],
    },
  },
  experiment: {
    'demo-session-3': {
      id: 'demo-session-3',
      agentType: 'claude-code',
      total: 4,
      hasMore: false,
      messages: [
        sessionMessage('user', 'Brainstorm feature ideas'),
        sessionMessage('assistant', 'A few good candidates: demo mode, offline cache, and deep links.'),
      ],
    },
  },
}

export const demoRecentSessions: { sessions: RecentSession[] } = {
  sessions: [
    {
      workspaceName: 'demo-project',
      sessionId: 'demo-session-1',
      agentType: 'claude-code',
      lastAccessed: now(),
    },
  ],
}

export const demoDefaultAgentType: AgentType = 'claude-code'
