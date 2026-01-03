import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Save, RefreshCw } from 'lucide-react'
import { api, type Credentials } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function FilesSettings() {
  const queryClient = useQueryClient()

  const { data: credentials, isLoading, error, refetch } = useQuery({
    queryKey: ['credentials'],
    queryFn: api.getCredentials,
  })

  const [files, setFiles] = useState<Array<{ dest: string; source: string }>>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (credentials && !initialized) {
      setFiles(Object.entries(credentials.files).map(([dest, source]) => ({ dest, source })))
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
    const filesObj: Record<string, string> = {}
    for (const { dest, source } of files) {
      if (dest.trim() && source.trim()) {
        filesObj[dest.trim()] = source.trim()
      }
    }
    mutation.mutate({ env: credentials?.env || {}, files: filesObj })
  }

  const addFile = () => {
    setFiles([...files, { dest: '', source: '' }])
    setHasChanges(true)
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  const updateFile = (index: number, field: 'dest' | 'source', value: string) => {
    const updated = [...files]
    updated[index] = { ...updated[index], [field]: value }
    setFiles(updated)
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
        <h1 className="text-3xl font-bold">Credential Files</h1>
        <p className="text-muted-foreground">
          Files copied into all new workspaces (e.g., SSH keys)
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
                <CardTitle>Credential Files</CardTitle>
                <CardDescription>
                  Files from the worker machine copied into each workspace
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={addFile} variant="outline" size="sm">
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
            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No credential files configured. Click "Add" to configure file copying.
              </p>
            ) : (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      type="text"
                      value={file.source}
                      onChange={(e) => updateFile(index, 'source', e.target.value)}
                      placeholder="~/.ssh/id_rsa (source on worker)"
                      className="flex-1 font-mono"
                    />
                    <span className="text-muted-foreground">→</span>
                    <Input
                      type="text"
                      value={file.dest}
                      onChange={(e) => updateFile(index, 'dest', e.target.value)}
                      placeholder="~/.ssh/id_rsa (dest in workspace)"
                      className="flex-1 font-mono"
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
