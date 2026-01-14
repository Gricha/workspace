import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export function TailscaleSettings() {
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tailscaleConfig'],
    queryFn: api.getTailscaleConfig,
  })

  const [enabled, setEnabled] = useState(false)
  const [authKey, setAuthKey] = useState('')
  const [hostnamePrefix, setHostnamePrefix] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled)
      setAuthKey(data.authKey || '')
      setHostnamePrefix(data.hostnamePrefix || '')
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: (config: { enabled?: boolean; authKey?: string; hostnamePrefix?: string }) =>
      api.updateTailscaleConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tailscaleConfig'] })
      setHasChanges(false)
    },
  })

  const checkChanges = (newEnabled: boolean, newAuthKey: string, newPrefix: string) => {
    if (!data) return false
    return (
      newEnabled !== data.enabled ||
      (newAuthKey !== data.authKey && newAuthKey !== '********' && newAuthKey !== '') ||
      newPrefix !== (data.hostnamePrefix || '')
    )
  }

  const handleEnabledChange = (value: boolean) => {
    setEnabled(value)
    setHasChanges(checkChanges(value, authKey, hostnamePrefix))
  }

  const handleAuthKeyChange = (value: string) => {
    setAuthKey(value)
    setHasChanges(checkChanges(enabled, value, hostnamePrefix))
  }

  const handlePrefixChange = (value: string) => {
    setHostnamePrefix(value)
    setHasChanges(checkChanges(enabled, authKey, value))
  }

  const handleSave = () => {
    const config: { enabled?: boolean; authKey?: string; hostnamePrefix?: string } = { enabled }
    if (authKey && authKey !== '********') {
      config.authKey = authKey
    }
    config.hostnamePrefix = hostnamePrefix || undefined
    mutation.mutate(config)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-destructive mb-4 text-center">
          <p className="font-medium">Failed to load Tailscale settings</p>
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
          <h1 className="page-title">Tailscale</h1>
          <p className="page-description">Configure Tailscale integration for workspace networking</p>
        </div>
        <div className="h-10 bg-secondary rounded animate-pulse" />
      </div>
    )
  }

  const isConfigured = data?.authKey && data.authKey !== ''

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Tailscale</h1>
        <p className="page-description">Configure Tailscale integration for workspace networking</p>
      </div>

      <div className="p-4 rounded-lg bg-muted/50 border">
        <div className="flex items-start gap-3">
          {isConfigured && enabled ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-medium">
              {isConfigured && enabled
                ? 'Tailscale is configured'
                : 'Tailscale is not configured'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {isConfigured && enabled
                ? 'New workspaces will automatically join your tailnet'
                : 'Configure Tailscale to enable direct network access to workspaces'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="section-header flex-1 mb-0 border-b-0">Configuration</div>
          <Button onClick={handleSave} disabled={mutation.isPending || !hasChanges} size="sm">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Tailscale</Label>
              <p className="text-sm text-muted-foreground">
                Automatically connect workspaces to your tailnet
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={handleEnabledChange} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authKey">Auth Key or OAuth Secret</Label>
            <Input
              id="authKey"
              type="password"
              value={authKey}
              onChange={(e) => handleAuthKeyChange(e.target.value)}
              placeholder={isConfigured ? '********' : 'tskey-auth-... or tskey-client-...'}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Generate a reusable auth key from the{' '}
              <a
                href="https://login.tailscale.com/admin/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Tailscale admin console
                <ExternalLink className="h-3 w-3" />
              </a>
              . Ephemeral keys recommended for automatic cleanup.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hostnamePrefix">Hostname Prefix (optional)</Label>
            <Input
              id="hostnamePrefix"
              type="text"
              value={hostnamePrefix}
              onChange={(e) => handlePrefixChange(e.target.value)}
              placeholder="e.g. perry-"
            />
            <p className="text-xs text-muted-foreground">
              Workspaces will be named <code className="bg-muted px-1 rounded">{hostnamePrefix ? `${hostnamePrefix}myworkspace` : 'myworkspace'}</code> on your tailnet.
              {!hostnamePrefix && ' Add a prefix like "perry-" to distinguish Perry workspaces.'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg border bg-card">
        <h3 className="font-medium mb-2">How it works</h3>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>
            <span className="font-medium text-foreground">1.</span> Each workspace joins your tailnet when started
          </li>
          <li>
            <span className="font-medium text-foreground">2.</span> Access workspaces directly by hostname, e.g.{' '}
            <code className="bg-muted px-1 rounded">http://{hostnamePrefix}myworkspace:3000</code>
          </li>
          <li>
            <span className="font-medium text-foreground">3.</span> SSH works via MagicDNS:{' '}
            <code className="bg-muted px-1 rounded">ssh workspace@{hostnamePrefix}myworkspace</code>
          </li>
          <li>
            <span className="font-medium text-foreground">4.</span> Workspaces are automatically removed from tailnet on delete
          </li>
        </ul>
      </div>

      {mutation.error && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
        </div>
      )}
    </div>
  )
}
