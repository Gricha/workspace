import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, Square, Trash2, Terminal as TerminalIcon, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Terminal } from '@/components/Terminal'

export function WorkspaceDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showTerminal, setShowTerminal] = useState(false)

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
      setShowTerminal(false)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/workspaces')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{workspace.name}</h1>
          <p className="text-muted-foreground">
            Created {new Date(workspace.created).toLocaleString()}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            workspace.status === 'running'
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          {workspace.status}
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Container ID</dt>
              <dd className="mt-1 font-mono text-sm">{workspace.containerId.slice(0, 12)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">SSH Port</dt>
              <dd className="mt-1 font-mono text-sm">{workspace.ports.ssh}</dd>
            </div>
            {workspace.repo && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Repository</dt>
                <dd className="mt-1 text-sm break-all">{workspace.repo}</dd>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Control your workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {workspace.status === 'running' ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => stopMutation.mutate()}
                    disabled={stopMutation.isPending}
                  >
                    <Square className="mr-2 h-4 w-4" />
                    {stopMutation.isPending ? 'Stopping...' : 'Stop'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowTerminal(!showTerminal)}
                  >
                    <TerminalIcon className="mr-2 h-4 w-4" />
                    {showTerminal ? 'Hide Terminal' : 'Terminal'}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {startMutation.isPending ? 'Starting...' : 'Start'}
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm(`Delete workspace "${workspace.name}"?`)) {
                    deleteMutation.mutate()
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showTerminal && workspace.status === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle>Terminal</CardTitle>
            <CardDescription>Connected to {workspace.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <Terminal workspaceName={workspace.name} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
