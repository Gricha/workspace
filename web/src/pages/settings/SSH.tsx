import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, Key, Check, AlertTriangle } from 'lucide-react'
import { api, type SSHSettings } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useSyncNotification } from '@/contexts/SyncContext'

export function SSHSettings() {
  const queryClient = useQueryClient()
  const showSyncNotification = useSyncNotification()

  const { data: sshSettings, isLoading, error, refetch } = useQuery({
    queryKey: ['sshSettings'],
    queryFn: api.getSSHSettings,
  })

  const { data: sshKeys } = useQuery({
    queryKey: ['sshKeys'],
    queryFn: api.listSSHKeys,
  })

  const [copyKeys, setCopyKeys] = useState<string[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (sshSettings && !initialized) {
      setCopyKeys(sshSettings.global.copy || [])
      setInitialized(true)
    }
  }, [sshSettings, initialized])

  const mutation = useMutation({
    mutationFn: (data: SSHSettings) => api.updateSSHSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sshSettings'] })
      setHasChanges(false)
      showSyncNotification()
    },
  })

  const handleSave = () => {
    mutation.mutate({
      autoAuthorizeHostKeys: true,
      global: {
        copy: copyKeys,
        authorize: sshSettings?.global.authorize || [],
      },
      workspaces: sshSettings?.workspaces || {},
    })
  }

  const toggleCopyKey = (keyPath: string) => {
    if (copyKeys.includes(keyPath)) {
      setCopyKeys(copyKeys.filter(k => k !== keyPath))
    } else {
      setCopyKeys([...copyKeys, keyPath])
    }
    setHasChanges(true)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-destructive mb-4 text-center">
          <p className="font-medium">Failed to load SSH settings</p>
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
          <h1 className="page-title">SSH Keys</h1>
          <p className="page-description">Configure SSH keys for workspace access</p>
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-secondary rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">SSH Keys</h1>
        <p className="page-description">Configure SSH keys for workspace git operations</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="section-header flex-1 mb-0 border-b-0">Keys to Copy</div>
          <Button
            onClick={handleSave}
            disabled={mutation.isPending || !hasChanges}
            size="sm"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Copy private keys to workspaces to simplify git operations (clone, push, pull) without
          needing to configure SSH agent forwarding.
        </p>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Copying private keys to workspaces is convenient but less secure. The keys will be
            accessible inside the container. Only enable for keys you're comfortable exposing.
          </p>
        </div>

        {sshKeys && sshKeys.filter(k => k.hasPrivateKey).length > 0 ? (
          <div className="space-y-2">
            {sshKeys.filter(k => k.hasPrivateKey).map((key) => (
              <div
                key={key.path}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleCopyKey(key.path)}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  copyKeys.includes(key.path)
                    ? 'bg-primary border-primary'
                    : 'border-muted-foreground/30'
                }`}>
                  {copyKeys.includes(key.path) && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {key.type.toUpperCase()} · {key.fingerprint}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
            <Key className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No SSH keys found in ~/.ssh/</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Generate keys with ssh-keygen to get started</p>
          </div>
        )}
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
