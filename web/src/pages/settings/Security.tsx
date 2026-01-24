import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, AlertCircle, CheckCircle2, Copy, Check, ShieldAlert } from 'lucide-react'
import { api, clearToken } from '@/lib/api'
import { Button } from '@/components/ui/button'
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

export function SecuritySettings() {
  const queryClient = useQueryClient()
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['authConfig'],
    queryFn: api.getAuthConfig,
  })

  const generateMutation = useMutation({
    mutationFn: api.generateAuthToken,
    onSuccess: (result) => {
      setGeneratedToken(result.token)
      setCopied(false)
      queryClient.invalidateQueries({ queryKey: ['authConfig'] })
    },
  })

  const disableMutation = useMutation({
    mutationFn: api.disableAuth,
    onSuccess: () => {
      setGeneratedToken(null)
      clearToken()
      queryClient.invalidateQueries({ queryKey: ['authConfig'] })
      setShowDisableConfirm(false)
    },
  })

  const handleCopy = async () => {
    if (generatedToken) {
      await navigator.clipboard.writeText(generatedToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleGenerate = () => {
    setGeneratedToken(null)
    generateMutation.mutate()
  }

  const handleDisable = () => {
    disableMutation.mutate()
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-destructive mb-4 text-center">
          <p className="font-medium">Failed to load security settings</p>
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
          <h1 className="page-title">Security</h1>
          <p className="page-description">Manage authentication and access control</p>
        </div>
        <div className="h-10 bg-secondary rounded animate-pulse" />
      </div>
    )
  }

  const isConfigured = data?.hasToken

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Security</h1>
        <p className="page-description">Manage authentication and access control</p>
      </div>

      <div className="p-4 rounded-lg bg-muted/50 border">
        <div className="flex items-start gap-3">
          {isConfigured ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-medium">
              {isConfigured
                ? 'Authentication is enabled'
                : 'Authentication is disabled'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {isConfigured
                ? 'API requests require a valid bearer token'
                : 'Anyone with network access can use the API'}
            </p>
            {isConfigured && data.tokenPreview && (
              <p className="text-sm text-muted-foreground mt-2">
                Current token: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">{data.tokenPreview}</code>
              </p>
            )}
          </div>
        </div>
      </div>

      {generatedToken && (
        <div className="p-4 rounded-lg border border-green-500/50 bg-green-500/10">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">Token Generated</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Copy this token now. It will not be shown again.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm break-all">
                  {generatedToken}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="section-header">Token Management</div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isConfigured ? 'Regenerate Token' : 'Generate Token'}
          </Button>

          {isConfigured && (
            <Button
              variant="outline"
              onClick={() => setShowDisableConfirm(true)}
              disabled={disableMutation.isPending}
            >
              Disable Authentication
            </Button>
          )}
        </div>

        {isConfigured && (
          <p className="text-sm text-muted-foreground">
            Regenerating will invalidate the current token. You will need to update all clients with the new token.
          </p>
        )}
      </div>

      <div className="p-4 rounded-lg border bg-card">
        <h3 className="font-medium mb-2">Using Authentication</h3>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>
            <span className="font-medium text-foreground">CLI:</span>{' '}
            Run <code className="bg-muted px-1 rounded">perry setup</code> and enter the token when prompted
          </li>
          <li>
            <span className="font-medium text-foreground">Web UI:</span>{' '}
            You will be prompted for the token when accessing the UI
          </li>
          <li>
            <span className="font-medium text-foreground">API:</span>{' '}
            Include <code className="bg-muted px-1 rounded">Authorization: Bearer {'<token>'}</code> header
          </li>
        </ul>
      </div>

      {!isConfigured && (
        <div className="p-4 rounded-lg border border-amber-500/50 bg-amber-500/10">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">Security Warning</p>
              <p className="text-sm text-muted-foreground mt-1">
                Without authentication, anyone with network access to your Perry agent can create,
                delete, and access workspaces. Enable authentication if the agent is accessible
                over a network.
              </p>
            </div>
          </div>
        </div>
      )}

      {(generateMutation.error || disableMutation.error) && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">
            {((generateMutation.error || disableMutation.error) as Error).message}
          </p>
        </div>
      )}

      <AlertDialog open={showDisableConfirm} onOpenChange={setShowDisableConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the authentication token. Anyone with network access to your
              Perry agent will be able to use the API without authentication.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disable Authentication
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
