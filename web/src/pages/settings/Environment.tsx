import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Save, RefreshCw } from 'lucide-react'
import { api, type Credentials } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function EnvironmentSettings() {
  const queryClient = useQueryClient()

  const { data: credentials, isLoading, error, refetch } = useQuery({
    queryKey: ['credentials'],
    queryFn: api.getCredentials,
  })

  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (credentials && !initialized) {
      setEnvVars(Object.entries(credentials.env).map(([key, value]) => ({ key, value })))
      setInitialized(true)
    }
  }, [credentials, initialized])

  const mutation = useMutation({
    mutationFn: (data: Credentials) => api.updateCredentials(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] })
      setHasChanges(false)
    },
  })

  const handleSave = () => {
    const env: Record<string, string> = {}
    for (const { key, value } of envVars) {
      if (key.trim()) {
        env[key.trim()] = value
      }
    }
    mutation.mutate({ env, files: credentials?.files || {} })
  }

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
    setHasChanges(true)
  }

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars]
    updated[index] = { ...updated[index], [field]: value }
    setEnvVars(updated)
    setHasChanges(true)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">Failed to load settings</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Environment Variables</h1>
        <p className="text-muted-foreground">
          Variables injected into all new workspaces
        </p>
      </div>

      {isLoading ? (
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 w-48 bg-muted rounded" />
            <div className="h-4 w-64 bg-muted rounded mt-2" />
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Environment Variables</CardTitle>
                <CardDescription>
                  These will be set in every new workspace container
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={addEnvVar} variant="outline" size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={mutation.isPending || !hasChanges}
                  size="sm"
                >
                  <Save className="mr-1 h-4 w-4" />
                  {mutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {envVars.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No environment variables configured. Click "Add" to create one.
              </p>
            ) : (
              <div className="space-y-2">
                {envVars.map((env, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      type="text"
                      value={env.key}
                      onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                      placeholder="NAME"
                      className="flex-1 font-mono"
                    />
                    <span className="text-muted-foreground">=</span>
                    <Input
                      type="password"
                      value={env.value}
                      onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                      placeholder="value"
                      className="flex-[2] font-mono"
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
            {mutation.error && (
              <p className="mt-2 text-sm text-destructive">
                {(mutation.error as Error).message}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
