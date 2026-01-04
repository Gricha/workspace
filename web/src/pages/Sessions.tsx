import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  Hash,
  Play,
  ChevronRight,
  Bot,
  User,
  Sparkles,
  Calendar,
  FolderOpen,
  Wrench,
  ChevronDown,
  CheckCircle2,
  ChevronLeft,
  Loader2,
} from 'lucide-react'
import Markdown from 'react-markdown'
import { api, type SessionInfo, type SessionMessage, type AgentType } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Chat } from '@/components/Chat'
import { Terminal } from '@/components/Terminal'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const AGENT_LABELS: Record<AgentType | 'all', string> = {
  all: 'All Agents',
  'claude-code': 'Claude Code',
  opencode: 'OpenCode',
  codex: 'Codex',
}

const AGENT_COLORS: Record<AgentType, string> = {
  'claude-code': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  opencode: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  codex: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
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

function SessionListItem({
  session,
  isSelected,
  onClick,
}: {
  session: SessionInfo
  isSelected: boolean
  onClick: () => void
}) {
  const isEmpty = session.messageCount === 0
  const hasPrompt = session.firstPrompt && session.firstPrompt.trim().length > 0

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent',
        isSelected && 'bg-accent border-primary/30',
        isEmpty && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={cn('text-xs font-normal', AGENT_COLORS[session.agentType])}
            >
              {AGENT_LABELS[session.agentType]}
            </Badge>
            {isEmpty && (
              <Badge variant="secondary" className="text-xs font-normal bg-muted text-muted-foreground">
                Empty
              </Badge>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(session.lastActivity)}
            </span>
          </div>
          <p className={cn(
            'text-sm line-clamp-2',
            hasPrompt ? 'text-foreground' : 'text-muted-foreground italic'
          )}>
            {hasPrompt ? session.firstPrompt : 'No prompt recorded'}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {session.messageCount} {session.messageCount === 1 ? 'message' : 'messages'}
            </span>
            <span className="truncate font-mono text-[11px]">{session.projectPath}</span>
          </div>
        </div>
        <ChevronRight
          className={cn(
            'h-4 w-4 text-muted-foreground flex-shrink-0 mt-1',
            isSelected && 'text-primary'
          )}
        />
      </div>
    </button>
  )
}

function ToolCallBubble({ message }: { message: SessionMessage }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (message.type === 'tool_use') {
    return (
      <div className="flex gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
          <Wrench className="h-3 w-3" />
        </div>
        <div className="flex-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')}
            />
            <span className="font-mono font-medium">{message.toolName}</span>
          </button>
          {isExpanded && message.toolInput && (
            <pre className="mt-2 p-2 bg-muted/50 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto border border-border/50">
              {message.toolInput}
            </pre>
          )}
        </div>
      </div>
    )
  }

  if (message.type === 'tool_result') {
    return (
      <div className="flex gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
        </div>
        <div className="flex-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')}
            />
            <span>Tool result</span>
          </button>
          {isExpanded && message.content && (
            <pre className="mt-2 p-2 bg-muted/50 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto border border-border/50 whitespace-pre-wrap">
              {message.content.slice(0, 2000)}
              {message.content.length > 2000 && '... (truncated)'}
            </pre>
          )}
        </div>
      </div>
    )
  }

  return null
}

function MessageBubble({ message }: { message: SessionMessage }) {
  if (message.type === 'tool_use' || message.type === 'tool_result') {
    return <ToolCallBubble message={message} />
  }

  const isUser = message.type === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary/10 text-primary'
            : 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-600'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted/50 border border-border/50 rounded-tl-sm'
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content || '(empty)'}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-pre:bg-background/50 prose-pre:border prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
            <Markdown>{message.content || '(empty)'}</Markdown>
          </div>
        )}
        {message.timestamp && (
          <p
            className={cn('text-[10px] mt-2 opacity-60', isUser ? 'text-right' : 'text-left')}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  )
}

function SessionMetadataHeader({ session }: { session: SessionInfo }) {
  const formattedDate = new Date(session.lastActivity).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const formattedTime = new Date(session.lastActivity).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex items-center gap-4 flex-wrap text-sm">
      <Badge
        variant="outline"
        className={cn('text-xs font-medium', AGENT_COLORS[session.agentType])}
      >
        {AGENT_LABELS[session.agentType]}
      </Badge>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Hash className="h-3.5 w-3.5" />
        <span>{session.messageCount} messages</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <FolderOpen className="h-3.5 w-3.5" />
        <span className="font-mono text-xs">{session.projectPath}</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>
          {formattedDate} at {formattedTime}
        </span>
      </div>
    </div>
  )
}

function SessionDetailView({
  workspaceName,
  session,
  onBack,
  onResume,
}: {
  workspaceName: string
  session: SessionInfo
  onBack: () => void
  onResume: (sessionId: string, agentType: AgentType) => void
}) {
  const { data: sessionDetail, isLoading } = useQuery({
    queryKey: ['session', workspaceName, session.id],
    queryFn: () => api.getSession(workspaceName, session.id),
  })

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="border-l pl-3">
            <h2 className="font-semibold text-lg">
              {session.firstPrompt?.slice(0, 80) || 'Untitled Session'}
              {(session.firstPrompt?.length || 0) > 80 && '...'}
            </h2>
            <SessionMetadataHeader session={session} />
          </div>
        </div>
        <Button onClick={() => onResume(session.id, session.agentType)}>
          <Play className="mr-2 h-4 w-4" />
          Resume Session
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessionDetail?.messages && sessionDetail.messages.length > 0 ? (
            <div className="space-y-6">
              {sessionDetail.messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No messages in this session</p>
              <p className="text-sm mt-1">This session may have been created but not used</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type ChatMode = { type: 'chat'; sessionId?: string } | { type: 'terminal'; command: string }

export function Sessions() {
  const { name: workspaceName } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null)
  const [chatMode, setChatMode] = useState<ChatMode | null>(null)
  const [agentFilter, setAgentFilter] = useState<AgentType | 'all'>('all')

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceName],
    queryFn: () => api.getWorkspace(workspaceName!),
    enabled: !!workspaceName,
  })

  const {
    data: sessionsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sessions', workspaceName, agentFilter],
    queryFn: () =>
      api.listSessions(workspaceName!, agentFilter === 'all' ? undefined : agentFilter, 50, 0),
    enabled: !!workspaceName && workspace?.status === 'running',
  })

  const sessions = sessionsData?.sessions || []
  const totalSessions = sessionsData?.total || 0

  const handleResume = (sessionId: string, agentType: AgentType) => {
    if (agentType === 'claude-code') {
      setChatMode({ type: 'chat', sessionId })
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
    if (agentType === 'claude-code') {
      setChatMode({ type: 'chat' })
    } else {
      const commands: Record<AgentType, string> = {
        'claude-code': 'claude',
        opencode: 'opencode',
        codex: 'codex',
      }
      setChatMode({ type: 'terminal', command: commands[agentType] })
    }
  }

  if (!workspaceName) {
    return null
  }

  if (workspace?.status !== 'running') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/workspaces/${workspaceName}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Sessions</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Workspace is not running</p>
            <Button onClick={() => navigate(`/workspaces/${workspaceName}`)}>
              Go to Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (chatMode) {
    if (chatMode.type === 'chat') {
      return (
        <div className="h-[calc(100vh-8rem)] flex flex-col">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" onClick={() => setChatMode(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sessions
            </Button>
            <h1 className="text-2xl font-bold">Claude Code</h1>
          </div>
          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-0 h-full">
              <Chat
                workspaceName={workspaceName}
                sessionId={chatMode.sessionId}
              />
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setChatMode(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Button>
          <h1 className="text-2xl font-bold">Agent Terminal</h1>
        </div>
        <Card>
          <CardContent className="p-0">
            <Terminal workspaceName={workspaceName} initialCommand={chatMode.command} />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (selectedSession) {
    return (
      <SessionDetailView
        workspaceName={workspaceName}
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
        onResume={handleResume}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/workspaces/${workspaceName}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Sessions</h1>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Bot className="mr-2 h-4 w-4" />
                {AGENT_LABELS[agentFilter]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={agentFilter}
                onValueChange={(value) => {
                  setAgentFilter(value as AgentType | 'all')
                  setSelectedSession(null)
                }}
              >
                <DropdownMenuRadioItem value="all">All Agents</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="claude-code">Claude Code</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="opencode">OpenCode</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="codex">Codex</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Play className="mr-2 h-4 w-4" />
                New Chat
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
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">{(error as Error).message}</p>
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No sessions found</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Play className="mr-2 h-4 w-4" />
                  Start a new chat
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
          </CardContent>
        </Card>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            {totalSessions} session{totalSessions !== 1 && 's'}
            {sessions.length < totalSessions && ` (showing ${sessions.length})`}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                isSelected={false}
                onClick={() => setSelectedSession(session)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
