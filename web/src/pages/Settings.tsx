import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Save, RefreshCw } from 'lucide-react'
import { api, type Credentials, type Scripts } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function Settings() {
  const queryClient = useQueryClient()

  const { data: credentials, isLoading: credentialsLoading, error: credentialsError, refetch: refetchCredentials } = useQuery({
    queryKey: ['credentials'],
    queryFn: api.getCredentials,
  })

  const { data: scripts, isLoading: scriptsLoading, error: scriptsError, refetch: refetchScripts } = useQuery({
    queryKey: ['scripts'],
    queryFn: api.getScripts,
  })

  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([])
  const [files, setFiles] = useState<Array<{ dest: string; source: string }>>([])
  const [postStartScript, setPostStartScript] = useState('')
  const [hasEnvChanges, setHasEnvChanges] = useState(false)
  const [hasFileChanges, setHasFileChanges] = useState(false)
  const [hasScriptChanges, setHasScriptChanges] = useState(false)

  const initializeFromCredentials = (creds: Credentials) => {
    setEnvVars(Object.entries(creds.env).map(([key, value]) => ({ key, value })))
    setFiles(Object.entries(creds.files).map(([dest, source]) => ({ dest, source })))
    setHasEnvChanges(false)
    setHasFileChanges(false)
  }

  const initializeFromScripts = (s: Scripts) => {
    setPostStartScript(s.post_start || '')
    setHasScriptChanges(false)
  }

  if (credentials && envVars.length === 0 && files.length === 0 && !hasEnvChanges && !hasFileChanges) {
    initializeFromCredentials(credentials)
  }

  if (scripts && !postStartScript && !hasScriptChanges) {
    initializeFromScripts(scripts)
  }

  const credentialsMutation = useMutation({
    mutationFn: (data: Credentials) => api.updateCredentials(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] })
      setHasEnvChanges(false)
      setHasFileChanges(false)
    },
  })

  const scriptsMutation = useMutation({
    mutationFn: (data: Scripts) => api.updateScripts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] })
      setHasScriptChanges(false)
    },
  })

  const handleSaveEnv = () => {
    const env: Record<string, string> = {}
    for (const { key, value } of envVars) {
      if (key.trim()) {
        env[key.trim()] = value
      }
    }
    const filesObj: Record<string, string> = {}
    for (const { dest, source } of files) {
      if (dest.trim() && source.trim()) {
        filesObj[dest.trim()] = source.trim()
      }
    }
    credentialsMutation.mutate({ env, files: filesObj })
  }

  const handleSaveFiles = () => {
    const env: Record<string, string> = {}
    for (const { key, value } of envVars) {
      if (key.trim()) {
        env[key.trim()] = value
      }
    }
    const filesObj: Record<string, string> = {}
    for (const { dest, source } of files) {
      if (dest.trim() && source.trim()) {
        filesObj[dest.trim()] = source.trim()
      }
    }
    credentialsMutation.mutate({ env, files: filesObj })
  }

  const handleSaveScripts = () => {
    scriptsMutation.mutate({
      post_start: postStartScript.trim() || undefined,
    })
  }

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
    setHasEnvChanges(true)
  }

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
    setHasEnvChanges(true)
  }

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars]
    updated[index] = { ...updated[index], [field]: value }
    setEnvVars(updated)
    setHasEnvChanges(true)
  }

  const addFile = () => {
    setFiles([...files, { dest: '', source: '' }])
    setHasFileChanges(true)
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
    setHasFileChanges(true)
  }

  const updateFile = (index: number, field: 'dest' | 'source', value: string) => {
    const updated = [...files]
    updated[index] = { ...updated[index], [field]: value }
    setFiles(updated)
    setHasFileChanges(true)
  }

  const isLoading = credentialsLoading || scriptsLoading
  const error = credentialsError || scriptsError

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">Failed to load settings</p>
        <Button onClick={() => { refetchCredentials(); refetchScripts() }} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure credentials and scripts for workspaces
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-6 w-48 bg-muted rounded" />
              <div className="h-4 w-64 bg-muted rounded mt-2" />
            </CardHeader>
          </Card>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Environment Variables</CardTitle>
                  <CardDescription>Variables injected into all new workspaces</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addEnvVar} variant="outline" size="sm">
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                  <Button
                    onClick={handleSaveEnv}
                    disabled={credentialsMutation.isPending || !hasEnvChanges}
                    size="sm"
                  >
                    <Save className="mr-1 h-4 w-4" />
                    {credentialsMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {envVars.length === 0 ? (
                <p className="text-sm text-muted-foreground">No environment variables configured</p>
              ) : (
                <div className="space-y-2">
                  {envVars.map((env, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={env.key}
                        onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                        placeholder="NAME"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      />
                      <span className="text-muted-foreground">=</span>
                      <input
                        type="password"
                        value={env.value}
                        onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                        placeholder="value"
                        className="flex-[2] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEnvVar(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {credentialsMutation.error && (
                <p className="mt-2 text-sm text-destructive">
                  {(credentialsMutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Credential Files</CardTitle>
                  <CardDescription>Files copied into all new workspaces (e.g., SSH keys)</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addFile} variant="outline" size="sm">
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                  <Button
                    onClick={handleSaveFiles}
                    disabled={credentialsMutation.isPending || !hasFileChanges}
                    size="sm"
                  >
                    <Save className="mr-1 h-4 w-4" />
                    {credentialsMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">No credential files configured</p>
              ) : (
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={file.source}
                        onChange={(e) => updateFile(index, 'source', e.target.value)}
                        placeholder="~/.ssh/id_rsa"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      />
                      <span className="text-muted-foreground">→</span>
                      <input
                        type="text"
                        value={file.dest}
                        onChange={(e) => updateFile(index, 'dest', e.target.value)}
                        placeholder="~/.ssh/id_rsa"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Post-Start Script</CardTitle>
                  <CardDescription>Script executed after each workspace starts</CardDescription>
                </div>
                <Button
                  onClick={handleSaveScripts}
                  disabled={scriptsMutation.isPending || !hasScriptChanges}
                  size="sm"
                >
                  <Save className="mr-1 h-4 w-4" />
                  {scriptsMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <input
                type="text"
                value={postStartScript}
                onChange={(e) => {
                  setPostStartScript(e.target.value)
                  setHasScriptChanges(true)
                }}
                placeholder="~/scripts/post-start.sh"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
              {scriptsMutation.error && (
                <p className="mt-2 text-sm text-destructive">
                  {(scriptsMutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
