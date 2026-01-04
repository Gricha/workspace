import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Play,
  Square,
  Trash2,
  Terminal as TerminalIcon,
  RefreshCw,
  MessageSquare,
  Info,
  ChevronRight,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Terminal } from '@/components/Terminal'

type ViewMode = 'overview' | 'terminal'

export function WorkspaceDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('overview')

  const { data: workspace, isLoading, error, refetch } = useQuery({
    queryKey: ['workspace', name],
    queryFn: () => api.getWorkspace(name!),
    enabled: !!name,
  })

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
      setViewMode('overview')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteWorkspace(name!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      navigate('/workspaces')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-4" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (error || !workspace) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/workspaces')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to workspaces
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive mb-4">
              {error ? (error as Error).message : 'Workspace not found'}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (viewMode === 'terminal' && workspace.status === 'running') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setViewMode('overview')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{workspace.name} - Terminal</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
          >
            <Square className="mr-2 h-4 w-4" />
            {stopMutation.isPending ? 'Stopping...' : 'Stop Workspace'}
          </Button>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Terminal workspaceName={workspace.name} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const isRunning = workspace.status === 'running'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/workspaces')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{workspace.name}</h1>
            <Badge variant={isRunning ? 'success' : 'muted'} className="px-2.5 py-0.5">
              {workspace.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Created {new Date(workspace.created).toLocaleDateString()}
          </p>
        </div>
      </div>

      {!isRunning ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Square className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium mb-2">Workspace is stopped</p>
            <p className="text-sm text-muted-foreground mb-6">
              Start the workspace to access the terminal and sessions
            </p>
            <Button
              size="lg"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              <Play className="mr-2 h-5 w-5" />
              {startMutation.isPending ? 'Starting...' : 'Start Workspace'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => setViewMode('terminal')}
            className="group text-left"
          >
            <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <TerminalIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">Terminal</h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Open an interactive shell session. Run commands, manage files, and work directly in your workspace.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button
            onClick={() => navigate(`/workspaces/${name}/sessions`)}
            className="group text-left"
          >
            <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-6 w-6 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">Sessions</h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      View and resume coding agent sessions. Start new chats with Claude Code, OpenCode, or Codex.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              Workspace Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <CardTitle className="text-base">Workspace Actions</CardTitle>
            <CardDescription>Manage your workspace lifecycle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isRunning ? (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
              >
                <Square className="mr-2 h-4 w-4" />
                {stopMutation.isPending ? 'Stopping...' : 'Stop Workspace'}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                {startMutation.isPending ? 'Starting...' : 'Start Workspace'}
              </Button>
            )}
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => {
                if (confirm(`Delete workspace "${workspace.name}"? This action cannot be undone.`)) {
                  deleteMutation.mutate()
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Workspace'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
