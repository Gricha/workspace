import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw } from 'lucide-react'
import { api, type Scripts } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSyncNotification } from '@/contexts/SyncContext'

export function ScriptsSettings() {
  const queryClient = useQueryClient()
  const showSyncNotification = useSyncNotification()

  const { data: scripts, isLoading, error, refetch } = useQuery({
    queryKey: ['scripts'],
    queryFn: api.getScripts,
  })

  const [postStartScript, setPostStartScript] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (scripts && !initialized) {
      setPostStartScript(scripts.post_start || '')
      setInitialized(true)
    }
  }, [scripts, initialized])

  const mutation = useMutation({
    mutationFn: (data: Scripts) => api.updateScripts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] })
      setHasChanges(false)
      showSyncNotification()
    },
  })

  const handleSave = () => {
    mutation.mutate({
      post_start: postStartScript.trim() || undefined,
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

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <div className="page-header">
          <h1 className="page-title">Scripts</h1>
          <p className="page-description">Custom scripts executed during workspace lifecycle</p>
        </div>
        <div className="h-10 bg-secondary rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Scripts</h1>
        <p className="page-description">Custom scripts executed during workspace lifecycle</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="section-header flex-1 mb-0 border-b-0">Post-Start Script</div>
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !hasChanges}
            size="sm"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        </div>

        <div className="space-y-3">
          <Input
            type="text"
            value={postStartScript}
            onChange={(e) => {
              setPostStartScript(e.target.value)
              setHasChanges(true)
            }}
            placeholder="~/scripts/post-start.sh"
            className="font-mono text-sm h-11 sm:h-9"
          />
          <p className="text-xs text-muted-foreground">
            Path to script on worker machine. Executed after each workspace starts as the workspace user.
          </p>
        </div>

        {mutation.error && (
          <div className="mt-4 rounded border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              {(mutation.error as Error).message}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
