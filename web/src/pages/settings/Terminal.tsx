import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function TerminalSettings() {
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['terminalSettings'],
    queryFn: api.getTerminalSettings,
  })

  const [preferredShell, setPreferredShell] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (data) {
      setPreferredShell(data.preferredShell || '')
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: (shell: string) => api.updateTerminalSettings({ preferredShell: shell || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminalSettings'] })
      setHasChanges(false)
    },
  })

  const handleShellChange = (value: string) => {
    setPreferredShell(value)
    setHasChanges(value !== (data?.preferredShell || ''))
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-destructive mb-4 text-center">
          <p className="font-medium">Failed to load terminal settings</p>
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
          <h1 className="page-title">Terminal</h1>
          <p className="page-description">Configure terminal preferences for workspaces</p>
        </div>
        <div className="h-10 bg-secondary rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Terminal</h1>
        <p className="page-description">Configure terminal preferences for workspaces</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="section-header flex-1 mb-0 border-b-0">Preferred Shell</div>
          <Button
            onClick={() => mutation.mutate(preferredShell)}
            disabled={mutation.isPending || !hasChanges}
            size="sm"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Set your preferred shell for terminal sessions. If the shell isn't available in a workspace, it will fall back to bash.
        </p>

        {data?.detectedShell && (
          <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">Detected from host</p>
            <div className="flex items-center justify-between">
              <code className="text-sm font-mono">{data.detectedShell}</code>
              {!preferredShell && (
                <span className="text-xs text-muted-foreground">(currently using)</span>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="shell">Shell path</Label>
          <Input
            id="shell"
            type="text"
            value={preferredShell}
            onChange={(e) => handleShellChange(e.target.value)}
            placeholder={data?.detectedShell || '/bin/bash'}
            className="font-mono"
          />
          <div className="flex gap-2 mt-2">
            {data?.detectedShell && preferredShell !== data.detectedShell && (
              <Button variant="outline" size="sm" onClick={() => handleShellChange(data.detectedShell!)}>
                Use detected
              </Button>
            )}
            {preferredShell && (
              <Button variant="outline" size="sm" onClick={() => handleShellChange('')}>
                Clear
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Common shells: <code className="bg-muted px-1 rounded">/bin/bash</code>, <code className="bg-muted px-1 rounded">/bin/zsh</code>, <code className="bg-muted px-1 rounded">/usr/bin/fish</code>
          </p>
        </div>
      </div>

      {mutation.error && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">
            {(mutation.error as Error).message}
          </p>
        </div>
      )}
    </div>
  )
}
