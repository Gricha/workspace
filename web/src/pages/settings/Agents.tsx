import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, Check, ExternalLink } from 'lucide-react'
import { api, type CodingAgents } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export function AgentsSettings() {
  const queryClient = useQueryClient()

  const { data: agents, isLoading, error, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  })

  const [openaiKey, setOpenaiKey] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [claudeToken, setClaudeToken] = useState('')
  const [openaiHasChanges, setOpenaiHasChanges] = useState(false)
  const [githubHasChanges, setGithubHasChanges] = useState(false)
  const [claudeHasChanges, setClaudeHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (agents && !initialized) {
      setOpenaiKey(agents.opencode?.api_key || '')
      setGithubToken(agents.github?.token || '')
      setClaudeToken(agents.claude_code?.oauth_token || '')
      setInitialized(true)
    }
  }, [agents, initialized])

  const mutation = useMutation({
    mutationFn: (data: CodingAgents) => api.updateAgents(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setOpenaiHasChanges(false)
      setGithubHasChanges(false)
      setClaudeHasChanges(false)
    },
  })

  const handleSaveOpenai = () => {
    mutation.mutate({
      ...agents,
      opencode: { api_key: openaiKey.trim() || undefined },
    })
  }

  const handleSaveGithub = () => {
    mutation.mutate({
      ...agents,
      github: { token: githubToken.trim() || undefined },
    })
  }

  const handleSaveClaude = () => {
    mutation.mutate({
      ...agents,
      claude_code: { oauth_token: claudeToken.trim() || undefined },
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

  const openaiConfigured = agents?.opencode?.api_key
  const githubConfigured = agents?.github?.token
  const claudeConfigured = agents?.claude_code?.oauth_token

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Coding Agents</h1>
        <p className="text-muted-foreground">
          Configure AI coding assistants for your workspaces
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
                <div className="h-4 w-48 bg-muted rounded mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-10 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">OpenCode</CardTitle>
                {openaiConfigured ? (
                  <Badge variant="default" className="bg-green-600">
                    <Check className="mr-1 h-3 w-3" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Configured</Badge>
                )}
              </div>
              <CardDescription>
                Configure your OpenAI API key for OpenCode integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => {
                    setOpenaiKey(e.target.value)
                    setOpenaiHasChanges(true)
                  }}
                  placeholder="sk-..."
                  className="flex-1 font-mono"
                />
                <Button
                  onClick={handleSaveOpenai}
                  disabled={mutation.isPending || !openaiHasChanges}
                  size="sm"
                >
                  <Save className="mr-1 h-4 w-4" />
                  {mutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Your API key will be injected as OPENAI_API_KEY into all new workspaces.
              </p>
              {mutation.error && (
                <p className="text-sm text-destructive">
                  {(mutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">GitHub</CardTitle>
                {githubConfigured ? (
                  <Badge variant="default" className="bg-green-600">
                    <Check className="mr-1 h-3 w-3" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Configured</Badge>
                )}
              </div>
              <CardDescription>
                Configure GitHub Personal Access Token for git operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={githubToken}
                  onChange={(e) => {
                    setGithubToken(e.target.value)
                    setGithubHasChanges(true)
                  }}
                  placeholder="ghp_..."
                  className="flex-1 font-mono"
                />
                <Button
                  onClick={handleSaveGithub}
                  disabled={mutation.isPending || !githubHasChanges}
                  size="sm"
                >
                  <Save className="mr-1 h-4 w-4" />
                  {mutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Your token will be injected as GITHUB_TOKEN into all new workspaces.
                </p>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,read:org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Create token
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {mutation.error && (
                <p className="text-sm text-destructive">
                  {(mutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Claude Code</CardTitle>
                {claudeConfigured ? (
                  <Badge variant="default" className="bg-green-600">
                    <Check className="mr-1 h-3 w-3" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Configured</Badge>
                )}
              </div>
              <CardDescription>
                Configure Claude Code token for AI-assisted coding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={claudeToken}
                  onChange={(e) => {
                    setClaudeToken(e.target.value)
                    setClaudeHasChanges(true)
                  }}
                  placeholder="sk-ant-oat01-..."
                  className="flex-1 font-mono"
                />
                <Button
                  onClick={handleSaveClaude}
                  disabled={mutation.isPending || !claudeHasChanges}
                  size="sm"
                >
                  <Save className="mr-1 h-4 w-4" />
                  {mutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Run <code className="bg-muted px-1 rounded">claude setup-token</code> in your terminal to generate a token.
                It will be injected as CLAUDE_CODE_OAUTH_TOKEN into all new workspaces.
              </p>
              {mutation.error && (
                <p className="text-sm text-destructive">
                  {(mutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Codex CLI</CardTitle>
                {openaiConfigured ? (
                  <Badge variant="default" className="bg-green-600">
                    <Check className="mr-1 h-3 w-3" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Configured</Badge>
                )}
              </div>
              <CardDescription>
                OpenAI Codex CLI for AI-assisted coding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Codex CLI uses the same OPENAI_API_KEY as OpenCode. Configure your OpenAI API key above to enable Codex CLI in all workspaces.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
