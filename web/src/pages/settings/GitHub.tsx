import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, ExternalLink, Check } from 'lucide-react'
import { api, type CodingAgents } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSyncNotification } from '@/contexts/SyncContext'

export function GitHubSettings() {
  const queryClient = useQueryClient()
  const showSyncNotification = useSyncNotification()

  const { data: agents, isLoading, error, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  })

  const [githubToken, setGithubToken] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [saved, setSaved] = useState(false)

  const showSaved = useCallback(() => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [])

  useEffect(() => {
    if (agents && !initialized) {
      setGithubToken(agents.github?.token || '')
      setInitialized(true)
    }
  }, [agents, initialized])

  const mutation = useMutation({
    mutationFn: (data: CodingAgents) => api.updateAgents(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setHasChanges(false)
      showSyncNotification()
      showSaved()
    },
  })

  const handleSave = () => {
    mutation.mutate({
      ...agents,
      github: { token: githubToken.trim() || undefined },
    })
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-destructive mb-4 text-center">
          <p className="font-medium">Failed to load settings</p>
          <p className="text-sm text-muted-foreground mt-1">Please check your connection</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  const isConfigured = !!agents?.github?.token

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <div className="page-header">
          <h1 className="page-title">GitHub</h1>
          <p className="page-description">Configure GitHub integration</p>
        </div>
        <div className="h-32 bg-secondary rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">GitHub</h1>
        <p className="page-description">Configure GitHub integration for git operations</p>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Personal Access Token</h3>
              {isConfigured && (
                <span className="status-configured text-xs font-medium">Configured</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Used for git operations. Injected as <code className="text-xs bg-secondary px-1 py-0.5 rounded">GITHUB_TOKEN</code>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Input
            type="password"
            value={githubToken}
            onChange={(e) => {
              setGithubToken(e.target.value)
              setHasChanges(true)
            }}
            placeholder="ghp_... or github_pat_..."
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Create a fine-grained PAT with repository access at{' '}
            <a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              GitHub Settings
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !hasChanges}
            size="sm"
            variant={saved ? 'secondary' : 'default'}
          >
            {saved ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                Saved
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {mutation.error && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
        </div>
      )}
    </div>
  )
}
