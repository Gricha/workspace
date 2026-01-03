import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { MessageSquare, Clock, Hash, Bot, ChevronRight, Boxes } from 'lucide-react'
import { api, type SessionInfo, type AgentType } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
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

interface SessionWithWorkspace extends SessionInfo {
  workspaceName: string
}

function SessionListItem({
  session,
  onClick,
}: {
  session: SessionWithWorkspace
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="text-xs font-normal bg-muted/50">
              <Boxes className="h-3 w-3 mr-1" />
              {session.workspaceName}
            </Badge>
            <Badge
              variant="outline"
              className={cn('text-xs font-normal', AGENT_COLORS[session.agentType])}
            >
              {AGENT_LABELS[session.agentType]}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(session.lastActivity)}
            </span>
          </div>
          <p className="text-sm truncate text-muted-foreground">
            {session.firstPrompt || 'No prompt'}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {session.messageCount} messages
            </span>
            <span className="truncate">{session.projectPath}</span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
      </div>
    </button>
  )
}

export function SessionsOverview() {
  const navigate = useNavigate()
  const [agentFilter, setAgentFilter] = useState<AgentType | 'all'>('all')

  const { data: workspaces, isLoading: isLoadingWorkspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.listWorkspaces,
  })

  const runningWorkspaces = workspaces?.filter((w) => w.status === 'running') || []

  const sessionsQueries = useQueries({
    queries: runningWorkspaces.map((workspace) => ({
      queryKey: ['sessions', workspace.name, agentFilter],
      queryFn: () => api.listSessions(workspace.name, agentFilter === 'all' ? undefined : agentFilter),
      enabled: workspace.status === 'running',
    })),
  })

  const isLoading = isLoadingWorkspaces || sessionsQueries.some((q) => q.isLoading)

  const allSessions: SessionWithWorkspace[] = runningWorkspaces.flatMap((workspace, idx) => {
    const sessionsData = sessionsQueries[idx]?.data
    if (!sessionsData?.sessions) return []
    return sessionsData.sessions.map((session) => ({
      ...session,
      workspaceName: workspace.name,
    }))
  })

  const sortedSessions = allSessions.sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  )

  const handleSessionClick = (session: SessionWithWorkspace) => {
    navigate(`/workspaces/${session.workspaceName}/sessions?session=${session.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">All Sessions</h1>
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
              onValueChange={(value) => setAgentFilter(value as AgentType | 'all')}
            >
              <DropdownMenuRadioItem value="all">All Agents</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="claude-code">Claude Code</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="opencode">OpenCode</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="codex">Codex</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {runningWorkspaces.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Boxes className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No running workspaces</p>
            <Button onClick={() => navigate('/workspaces')}>Go to Workspaces</Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      ) : sortedSessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No sessions found across any workspace</p>
            <p className="text-sm text-muted-foreground">
              Start a chat in one of your{' '}
              <Link to="/workspaces" className="text-primary hover:underline">
                running workspaces
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {sortedSessions.length} session{sortedSessions.length !== 1 && 's'} across{' '}
              {runningWorkspaces.length} workspace{runningWorkspaces.length !== 1 && 's'}
            </h2>
          </div>
          {sortedSessions.map((session) => (
            <SessionListItem
              key={`${session.workspaceName}-${session.id}`}
              session={session}
              onClick={() => handleSessionClick(session)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
