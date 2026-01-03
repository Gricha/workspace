import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw } from 'lucide-react'
import { api, type Scripts } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function ScriptsSettings() {
  const queryClient = useQueryClient()

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
    },
  })

  const handleSave = () => {
    mutation.mutate({
      post_start: postStartScript.trim() || undefined,
    })
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
        <h1 className="text-3xl font-bold">Scripts</h1>
        <p className="text-muted-foreground">
          Custom scripts executed during workspace lifecycle
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
                <CardTitle>Post-Start Script</CardTitle>
                <CardDescription>
                  Script executed after each workspace starts (path on worker machine)
                </CardDescription>
              </div>
              <Button
                onClick={handleSave}
                disabled={mutation.isPending || !hasChanges}
                size="sm"
              >
                <Save className="mr-1 h-4 w-4" />
                {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Input
              type="text"
              value={postStartScript}
              onChange={(e) => {
                setPostStartScript(e.target.value)
                setHasChanges(true)
              }}
              placeholder="~/scripts/post-start.sh"
              className="font-mono"
            />
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
