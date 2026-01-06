import { useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Play,
  Square,
  Trash2,
  Terminal as TerminalIcon,
  RefreshCw,
  MessageSquare,
  Settings,
  ArrowLeft,
  Clock,
  Hash,
  ChevronRight,
  Bot,
  Loader2,
  Copy,
  Check,
  Info,
  AlertTriangle,
  FolderSync,
} from 'lucide-react'
import { api, type SessionInfo, type AgentType } from '@/lib/api'
import { HOST_WORKSPACE_NAME } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Terminal } from '@/components/Terminal'
import { Chat } from '@/components/Chat'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type TabType = 'sessions' | 'terminal' | 'settings'

const AGENT_LABELS: Record<AgentType | 'all', string> = {
  all: 'All Agents',
  'claude-code': 'Claude Code',
  opencode: 'OpenCode',
  codex: 'Codex',
}

const AGENT_BADGES: Record<AgentType, string> = {
  'claude-code': 'CC',
  opencode: 'OC',
  codex: 'CX',
}

const AGENT_COLORS: Record<AgentType, string> = {
  'claude-code': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  opencode: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  codex: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
}

type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Older'

function getDateGroup(dateString: string): DateGroup {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)
  const sessionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (sessionDate.getTime() >= today.getTime()) return 'Today'
  if (sessionDate.getTime() >= yesterday.getTime()) return 'Yesterday'
  if (sessionDate.getTime() >= weekAgo.getTime()) return 'This Week'
  return 'Older'
}

function groupSessionsByDate(sessions: SessionInfo[]): Record<DateGroup, SessionInfo[]> {
  const groups: Record<DateGroup, SessionInfo[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  }
  for (const session of sessions) {
    groups[getDateGroup(session.lastActivity)].push(session)
  }
  return groups
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function CopyableSessionId({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(sessionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors group"
      title={`Click to copy: ${sessionId}`}
      data-testid="session-id"
    >
      <span>{sessionId.slice(0, 8)}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  )
}

function SessionListItem({ session, onClick }: { session: SessionInfo; onClick: () => void }) {
  const isEmpty = session.messageCount === 0
  const hasPrompt = session.firstPrompt && session.firstPrompt.trim().length > 0
  const displayTitle = session.name || (hasPrompt ? session.firstPrompt : 'No prompt recorded')

  return (
    <button
      onClick={onClick}
      data-testid="session-list-item"
      className={cn(
        'w-full text-left px-3 sm:px-4 py-3 border-b border-border/50 transition-colors hover:bg-accent/50 flex items-center gap-2 sm:gap-4 min-h-[56px]',
        isEmpty && 'opacity-60'
      )}
    >
      <span
        className={cn(
          'shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded',
          AGENT_COLORS[session.agentType]
        )}
        data-testid="agent-badge"
      >
        [{AGENT_BADGES[session.agentType]}]
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'text-sm font-medium truncate',
              hasPrompt || session.name ? 'text-foreground' : 'text-muted-foreground italic'
            )}
          >
            {displayTitle}
          </p>
          {isEmpty && (
            <Badge variant="secondary" className="text-[10px] font-normal bg-muted text-muted-foreground shrink-0 hidden sm:inline-flex">
              Empty
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs text-muted-foreground">
          <CopyableSessionId sessionId={session.id} />
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {session.messageCount}
          </span>
          <span className="truncate font-mono text-[11px] hidden sm:inline">{session.projectPath}</span>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3 hidden sm:block" />
        <span className="text-[11px] sm:text-xs">{formatTimeAgo(session.lastActivity)}</span>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  )
}

type ChatMode = { type: 'chat'; sessionId?: string; agentType?: AgentType } | { type: 'terminal'; command: string }

export function WorkspaceDetail() {
  const { name: rawName } = useParams<{ name: string }>()
  const name = rawName ? decodeURIComponent(rawName) : undefined
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const isHostWorkspace = name === HOST_WORKSPACE_NAME
  const currentTab = (searchParams.get('tab') as TabType) || 'sessions'
  const [chatMode, setChatMode] = useState<ChatMode | null>(null)
  const [agentFilter, setAgentFilter] = useState<AgentType | 'all'>('all')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  
  const setTab = (tab: TabType) => {
    setChatMode(null)
    setSearchParams({ tab })
  }

  const handleSessionId = useCallback((sessionId: string) => {
    if (name && chatMode?.type === 'chat' && chatMode.agentType) {
      api.recordSessionAccess(name, sessionId, chatMode.agentType).catch(() => {})
    }
    setChatMode((prev) => prev?.type === 'chat' ? { ...prev, sessionId } : prev)
  }, [name, chatMode])

  const { data: hostInfo, isLoading: hostLoading } = useQuery({
    queryKey: ['hostInfo'],
    queryFn: api.getHostInfo,
    enabled: isHostWorkspace,
  })

  const { data: workspace, isLoading: workspaceLoading, error, refetch } = useQuery({
    queryKey: ['workspace', name],
    queryFn: () => api.getWorkspace(name!),
    enabled: !!name && !isHostWorkspace,
  })

  const isLoading = isHostWorkspace ? hostLoading : workspaceLoading

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', name, agentFilter],
    queryFn: () => api.listSessions(name!, agentFilter === 'all' ? undefined : agentFilter, 50, 0),
    enabled: !!name && ((isHostWorkspace && hostInfo?.enabled) || (!isHostWorkspace && workspace?.status === 'running')),
  })

  const sessions = sessionsData?.sessions || []
  const totalSessions = sessionsData?.total || 0

  const startMutation = useMutation({
    mutationFn: () => api.startWorkspace(name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', name] })
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => api.stopWorkspace(name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', name] })
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      setChatMode(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteWorkspace(name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      navigate('/workspaces')
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => api.syncWorkspace(name!),
  })

  const handleResume = (sessionId: string, agentType: AgentType) => {
    if (agentType === 'claude-code' || agentType === 'opencode') {
      setChatMode({ type: 'chat', sessionId, agentType })
    } else {
      const commands: Record<AgentType, string> = {
        'claude-code': `claude -r ${sessionId}`,
        opencode: `opencode --resume ${sessionId}`,
        codex: `codex resume ${sessionId}`,
      }
      setChatMode({ type: 'terminal', command: commands[agentType] })
    }
  }

  const handleNewChat = (agentType: AgentType = 'claude-code') => {
    if (agentType === 'claude-code' || agentType === 'opencode') {
      setChatMode({ type: 'chat', agentType })
    } else {
      const commands: Record<AgentType, string> = {
        'claude-code': 'claude',
        opencode: 'opencode',
        codex: 'codex',
      }
      setChatMode({ type: 'terminal', command: commands[agentType] })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isHostWorkspace) {
    if (!hostInfo?.enabled) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <p className="text-xl font-medium">Host Access Disabled</p>
          <p className="text-muted-foreground text-center max-w-md">
            Enable host access from the dashboard to use terminal and agents on your host machine.
          </p>
          <Button variant="outline" onClick={() => navigate('/workspaces')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      )
    }
  } else if (error || !workspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive">{error ? (error as Error).message : 'Workspace not found'}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/workspaces')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const isRunning = isHostWorkspace ? (hostInfo?.enabled ?? false) : workspace?.status === 'running'
  const isError = isHostWorkspace ? false : workspace?.status === 'error'
  const displayName = isHostWorkspace ? (hostInfo?.hostname || 'Host') : workspace?.name

  const tabs = isHostWorkspace
    ? [
        { id: 'sessions' as const, label: 'Sessions', icon: MessageSquare },
        { id: 'terminal' as const, label: 'Terminal', icon: TerminalIcon },
      ]
    : [
        { id: 'sessions' as const, label: 'Sessions', icon: MessageSquare },
        { id: 'terminal' as const, label: 'Terminal', icon: TerminalIcon },
        { id: 'settings' as const, label: 'Settings', icon: Settings },
      ]

  const renderStartPrompt = () => (
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className={cn(
        "h-16 w-16 rounded-full flex items-center justify-center mb-6",
        isError ? "bg-destructive/10" : "bg-muted/50"
      )}>
        {isError ? (
          <AlertTriangle className="h-8 w-8 text-destructive" />
        ) : (
          <Square className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <p className="text-xl font-medium mb-2">
        {isError ? 'Workspace needs recovery' : 'Workspace is stopped'}
      </p>
      <p className="text-muted-foreground mb-6 text-center max-w-md">
        {isError
          ? 'The container was deleted externally. Click below to recreate it with existing data.'
          : 'Start the workspace to access this feature'}
      </p>
      {startMutation.error && (
        <div className="mb-4 px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm max-w-md text-center">
          {(startMutation.error as Error).message || 'Failed to start workspace'}
        </div>
      )}
      <Button
        size="lg"
        onClick={() => startMutation.mutate()}
        disabled={startMutation.isPending}
      >
        {startMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {isError ? 'Recovering...' : 'Starting...'}
          </>
        ) : (
          <>
            {isError ? <RefreshCw className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
            {isError ? 'Recover Workspace' : 'Start Workspace'}
          </>
        )}
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border/50 bg-card/50 min-h-[48px]">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 flex-shrink-0" onClick={() => navigate('/workspaces')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-semibold truncate">{displayName}</span>
          {isHostWorkspace ? (
            <Badge variant="secondary" className="text-xs flex-shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/20">
              host
            </Badge>
          ) : isRunning ? (
            <span className="h-2 w-2 rounded-full bg-success animate-pulse flex-shrink-0" title="Running" />
          ) : isError ? (
            <Badge variant="destructive" className="text-xs flex-shrink-0">error</Badge>
          ) : (
            <Badge variant="muted" className="text-xs flex-shrink-0">stopped</Badge>
          )}
        </div>
        {!isHostWorkspace && (
          isRunning ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              className="text-muted-foreground hover:text-destructive h-9 px-2 sm:px-3 flex-shrink-0"
            >
              <Square className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">{stopMutation.isPending ? 'Stopping...' : 'Stop'}</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="h-9 px-2 sm:px-3 flex-shrink-0"
            >
              {startMutation.isPending ? (
                <Loader2 className="h-4 w-4 sm:mr-1 animate-spin" />
              ) : isError ? (
                <RefreshCw className="h-4 w-4 sm:mr-1" />
              ) : (
                <Play className="h-4 w-4 sm:mr-1" />
              )}
              <span className="hidden sm:inline">
                {startMutation.isPending
                  ? isError ? 'Recovering...' : 'Starting...'
                  : isError ? 'Recover' : 'Start'}
              </span>
            </Button>
          )
        )}
      </div>

      <div className="flex border-b border-border/50 bg-card/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              'flex items-center justify-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px min-h-[44px]',
              currentTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
            title={tab.label}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {currentTab === 'sessions' && (
          <div className="h-full flex flex-col">
            {!isRunning ? (
              renderStartPrompt()
            ) : chatMode ? (
              chatMode.type === 'chat' ? (
                <Chat
                  workspaceName={name!}
                  sessionId={chatMode.sessionId}
                  agentType={chatMode.agentType}
                  onSessionId={handleSessionId}
                  onBack={() => setChatMode(null)}
                />
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
                    <Button variant="ghost" size="sm" onClick={() => setChatMode(null)}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back to Sessions
                    </Button>
                    <span className="text-sm font-medium">Agent Terminal</span>
                  </div>
                  <div className="flex-1">
                    <Terminal workspaceName={name!} initialCommand={chatMode.command} />
                  </div>
                </div>
              )
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-3 border-b border-border/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 px-2 sm:px-3">
                          <Bot className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">{AGENT_LABELS[agentFilter]}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuRadioGroup
                          value={agentFilter}
                          onValueChange={(value) => setAgentFilter(value as AgentType | 'all')}
                        >
                          <DropdownMenuRadioItem value="all">All Agents</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="claude-code">Claude Code</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="opencode">OpenCode</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="codex">Codex</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {totalSessions > 0 && (
                      <span className="text-xs sm:text-sm text-muted-foreground truncate">
                        {totalSessions} session{totalSessions !== 1 && 's'}
                      </span>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="h-9 px-2 sm:px-3 flex-shrink-0">
                        <Play className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">New Chat</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleNewChat('claude-code')}>
                        <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
                        Claude Code
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleNewChat('opencode')}>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                        OpenCode
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleNewChat('codex')}>
                        <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                        Codex
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {sessionsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground mb-4">No sessions yet</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button>
                            <Play className="mr-2 h-4 w-4" />
                            Start a chat
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleNewChat('claude-code')}>
                            <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
                            Claude Code
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleNewChat('opencode')}>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                            OpenCode
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleNewChat('codex')}>
                            <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                            Codex
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : (
                    <div data-testid="sessions-list">
                      {(['Today', 'Yesterday', 'This Week', 'Older'] as DateGroup[]).map((group) => {
                        const groupedSessions = groupSessionsByDate(sessions)
                        const groupSessions = groupedSessions[group]
                        if (groupSessions.length === 0) return null
                        return (
                          <div key={group} data-testid={`date-group-${group.toLowerCase().replace(' ', '-')}`}>
                            <div className="px-4 py-2 bg-muted/30 border-b border-border/50 sticky top-0">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {group}
                              </span>
                            </div>
                            {groupSessions.map((session) => (
                              <SessionListItem
                                key={session.id}
                                session={session}
                                onClick={() => handleResume(session.id, session.agentType)}
                              />
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {currentTab === 'terminal' && (
          <div className="h-full flex flex-col">
            {!isRunning ? (
              renderStartPrompt()
            ) : (
              <Terminal key={isHostWorkspace ? HOST_WORKSPACE_NAME : workspace!.name} workspaceName={isHostWorkspace ? HOST_WORKSPACE_NAME : workspace!.name} />
            )}
          </div>
        )}

        {currentTab === 'settings' && !isHostWorkspace && workspace && (
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-2xl space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    Workspace Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={isRunning ? 'success' : isError ? 'destructive' : 'muted'}>
                      {isRunning ? 'running' : isError ? 'error' : 'stopped'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Container ID</span>
                    <span className="font-mono text-sm">{workspace.containerId.slice(0, 12)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">SSH Port</span>
                    <span className="font-mono text-sm">{workspace.ports.ssh}</span>
                  </div>
                  {workspace.repo && (
                    <div className="flex justify-between items-start py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Repository</span>
                      <span className="text-sm text-right break-all max-w-[60%]">{workspace.repo}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-muted-foreground">Created</span>
                    <span className="text-sm">{new Date(workspace.created).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderSync className="h-4 w-4 text-muted-foreground" />
                    Sync Credentials
                  </CardTitle>
                  <CardDescription>
                    Sync configuration files and credentials from host to workspace
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">Sync Files</p>
                      <p className="text-sm text-muted-foreground">
                        Copy .gitconfig, Claude credentials, Codex auth, and configured files
                      </p>
                      {syncMutation.isSuccess && (
                        <p className="text-sm text-success mt-1 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Synced successfully
                        </p>
                      )}
                      {syncMutation.error && (
                        <p className="text-sm text-destructive mt-1">
                          {(syncMutation.error as Error).message || 'Sync failed'}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => syncMutation.mutate()}
                      disabled={syncMutation.isPending || !isRunning}
                    >
                      {syncMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FolderSync className="mr-2 h-4 w-4" />
                      )}
                      {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
                    </Button>
                  </div>
                  {!isRunning && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Start the workspace to sync files
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-destructive/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription>Destructive actions that cannot be undone</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isRunning ? (
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
                      <div>
                        <p className="font-medium text-sm">Stop Workspace</p>
                        <p className="text-sm text-muted-foreground">Stop the running container. You can restart it later.</p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => stopMutation.mutate()}
                        disabled={stopMutation.isPending}
                      >
                        <Square className="mr-2 h-4 w-4" />
                        {stopMutation.isPending ? 'Stopping...' : 'Stop'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
                      <div>
                        <p className="font-medium text-sm">Start Workspace</p>
                        <p className="text-sm text-muted-foreground">Start the container to use terminal and sessions.</p>
                        {startMutation.error && (
                          <p className="text-sm text-destructive mt-1">
                            {(startMutation.error as Error).message || 'Failed to start'}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => startMutation.mutate()}
                        disabled={startMutation.isPending}
                      >
                        {startMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        {startMutation.isPending ? 'Starting...' : 'Start'}
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                    <div>
                      <p className="font-medium text-sm">Delete Workspace</p>
                      <p className="text-sm text-muted-foreground">Permanently delete this workspace and all its data.</p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setShowDeleteDialog(true)
                        setDeleteConfirmName('')
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {workspace && (
        <AlertDialog open={showDeleteDialog} onOpenChange={(open) => !open && setShowDeleteDialog(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the workspace
                <span className="font-mono font-semibold text-foreground"> {workspace.name}</span> and all its data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="confirm-name" className="text-sm text-muted-foreground">
                Type <span className="font-mono font-semibold text-foreground">{workspace.name}</span> to confirm
              </Label>
              <Input
                id="confirm-name"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Enter workspace name"
                className="mt-2"
                autoComplete="off"
                data-testid="delete-confirm-input"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConfirmName === workspace.name) {
                    deleteMutation.mutate()
                  }
                }}
                disabled={deleteConfirmName !== workspace.name || deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Workspace'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
