import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, ExternalLink, Sparkles, Github, Code2 } from 'lucide-react'
import { api, type CodingAgents } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function StatusIndicator({ configured }: { configured: boolean }) {
  if (!configured) return null
  return (
    <span className="status-configured text-xs font-medium">
      Configured
    </span>
  )
}

export function AgentsSettings() {
  const queryClient = useQueryClient()

  const { data: agents, isLoading, error, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  })

  const [openaiKey, setOpenaiKey] = useState('')
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [claudeOAuthToken, setClaudeOAuthToken] = useState('')
  const [openaiHasChanges, setOpenaiHasChanges] = useState(false)
  const [githubHasChanges, setGithubHasChanges] = useState(false)
  const [claudeHasChanges, setClaudeHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (agents && !initialized) {
      setOpenaiKey(agents.opencode?.api_key || '')
      setOpenaiBaseUrl(agents.opencode?.api_base_url || '')
      setGithubToken(agents.github?.token || '')
      setClaudeOAuthToken(agents.claude_code?.oauth_token || '')
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
      opencode: {
        api_key: openaiKey.trim() || undefined,
        api_base_url: openaiBaseUrl.trim() || undefined,
      },
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
      claude_code: {
        oauth_token: claudeOAuthToken.trim() || undefined,
      },
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

  const openaiConfigured = !!agents?.opencode?.api_key
  const githubConfigured = !!agents?.github?.token
  const claudeConfigured = !!agents?.claude_code?.oauth_token

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="page-header">
          <h1 className="page-title">Coding Agents</h1>
          <p className="page-description">Configure AI assistants for your workspaces</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="agent-row animate-pulse">
              <div className="agent-icon bg-secondary" />
              <div className="agent-info space-y-2">
                <div className="h-4 w-24 bg-secondary rounded" />
                <div className="h-3 w-48 bg-secondary rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1 className="page-title">Coding Agents</h1>
        <p className="page-description">Configure AI assistants for your workspaces</p>
      </div>

      {/* AI Assistants Section */}
      <div>
        <div className="section-header">AI Assistants</div>

        {/* OpenCode */}
        <div className="agent-row">
          <div className="agent-icon">
            <Code2 className="h-5 w-5" />
          </div>
          <div className="agent-info">
            <div className="agent-name">
              OpenCode
              <StatusIndicator configured={openaiConfigured} />
            </div>
            <p className="agent-description">
              OpenAI-compatible API for AI-assisted coding. Injected as <code className="text-xs bg-secondary px-1 py-0.5 rounded">OPENAI_API_KEY</code> and <code className="text-xs bg-secondary px-1 py-0.5 rounded">OPENAI_BASE_URL</code>
            </p>
            <div className="space-y-2 mt-2">
              <div className="agent-input flex gap-2">
                <Input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => {
                    setOpenaiKey(e.target.value)
                    setOpenaiHasChanges(true)
                  }}
                  placeholder="sk-... (API key)"
                  className="flex-1 font-mono text-sm h-9"
                />
              </div>
              <div className="agent-input flex gap-2">
                <Input
                  type="text"
                  value={openaiBaseUrl}
                  onChange={(e) => {
                    setOpenaiBaseUrl(e.target.value)
                    setOpenaiHasChanges(true)
                  }}
                  placeholder="https://api.openai.com/v1 (optional, for other providers)"
                  className="flex-1 font-mono text-sm h-9"
                />
                <Button
                  onClick={handleSaveOpenai}
                  disabled={mutation.isPending || !openaiHasChanges}
                  size="sm"
                  className="h-9"
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Claude Code */}
        <div className="agent-row">
          <div className="agent-icon">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="agent-info">
            <div className="agent-name">
              Claude Code
              <StatusIndicator configured={claudeConfigured} />
            </div>
            <p className="agent-description">
              OAuth token for headless operation. Run <code className="text-xs bg-secondary px-1 py-0.5 rounded">claude setup-token</code> locally to generate.
            </p>
            <div className="agent-input flex gap-2 mt-2">
              <Input
                type="password"
                value={claudeOAuthToken}
                onChange={(e) => {
                  setClaudeOAuthToken(e.target.value)
                  setClaudeHasChanges(true)
                }}
                placeholder="sk-ant-oat01-... (OAuth token)"
                className="flex-1 font-mono text-sm h-9"
              />
              <Button
                onClick={handleSaveClaude}
                disabled={mutation.isPending || !claudeHasChanges}
                size="sm"
                className="h-9"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Version Control Section */}
      <div>
        <div className="section-header">Version Control</div>

        {/* GitHub */}
        <div className="agent-row">
          <div className="agent-icon">
            <Github className="h-5 w-5" />
          </div>
          <div className="agent-info">
            <div className="agent-name">
              GitHub
              <StatusIndicator configured={githubConfigured} />
            </div>
            <p className="agent-description">
              Personal Access Token for git operations. Injected as <code className="text-xs bg-secondary px-1 py-0.5 rounded">GITHUB_TOKEN</code>
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
              >
                Create token
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Use a fine-grained PAT with repository access permissions.
            </p>
            <div className="agent-input flex gap-2">
              <Input
                type="password"
                value={githubToken}
                onChange={(e) => {
                  setGithubToken(e.target.value)
                  setGithubHasChanges(true)
                }}
                placeholder="ghp_..."
                className="flex-1 font-mono text-sm h-9"
              />
              <Button
                onClick={handleSaveGithub}
                disabled={mutation.isPending || !githubHasChanges}
                size="sm"
                className="h-9"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </div>
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
