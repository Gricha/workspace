import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, ExternalLink, Check } from 'lucide-react'
import { api, type CodingAgents, type ModelInfo } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSyncNotification } from '@/contexts/SyncContext'
import { AgentIcon } from '@/components/AgentIcon'
import { SearchableModelSelect } from '@/components/SearchableModelSelect'

const FALLBACK_CLAUDE_MODELS: ModelInfo[] = [
  { id: 'sonnet', name: 'Sonnet', description: 'Fast and cost-effective', provider: 'anthropic' },
  { id: 'opus', name: 'Opus', description: 'Most capable', provider: 'anthropic' },
  { id: 'haiku', name: 'Haiku', description: 'Fastest, lowest cost', provider: 'anthropic' },
]

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
  const showSyncNotification = useSyncNotification()

  const { data: agents, isLoading, error, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  })

  const { data: claudeModelsData } = useQuery({
    queryKey: ['models', 'claude-code'],
    queryFn: () => api.listModels('claude-code'),
  })

  const { data: opencodeModelsData } = useQuery({
    queryKey: ['models', 'opencode'],
    queryFn: () => api.listModels('opencode'),
  })

  const claudeModels = claudeModelsData?.models?.length ? claudeModelsData.models : FALLBACK_CLAUDE_MODELS
  const opencodeModels = opencodeModelsData?.models || []

  const [opencodeZenToken, setOpencodeZenToken] = useState('')
  const [opencodeModel, setOpencodeModel] = useState('')
  const [opencodeServerHostname, setOpencodeServerHostname] = useState('0.0.0.0')
  const [opencodeServerUsername, setOpencodeServerUsername] = useState('')
  const [opencodeServerPassword, setOpencodeServerPassword] = useState('')
  const [claudeOAuthToken, setClaudeOAuthToken] = useState('')
  const [claudeModel, setClaudeModel] = useState('sonnet')
  const [opencodeHasChanges, setOpencodeHasChanges] = useState(false)
  const [claudeHasChanges, setClaudeHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [savedSection, setSavedSection] = useState<'opencode' | 'claude' | null>(null)

  const showSaved = useCallback((section: 'opencode' | 'claude') => {
    setSavedSection(section)
    setTimeout(() => setSavedSection(null), 2000)
  }, [])

  useEffect(() => {
    if (agents && !initialized) {
      setOpencodeZenToken(agents.opencode?.zen_token || '')
      setOpencodeModel(agents.opencode?.model || '')
      setOpencodeServerHostname(agents.opencode?.server?.hostname || '0.0.0.0')
      setOpencodeServerUsername(agents.opencode?.server?.username || '')
      setOpencodeServerPassword(agents.opencode?.server?.password || '')
      setClaudeOAuthToken(agents.claude_code?.oauth_token || '')
      setClaudeModel(agents.claude_code?.model || 'sonnet')
      setInitialized(true)
    }
  }, [agents, initialized])

  const mutation = useMutation({
    mutationFn: (data: CodingAgents) => api.updateAgents(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setOpencodeHasChanges(false)
      setClaudeHasChanges(false)
      showSyncNotification()
    },
  })

  const handleSaveOpencode = () => {
    mutation.mutate(
      {
        ...agents,
          opencode: {
            zen_token: opencodeZenToken.trim() || undefined,
            model: opencodeModel || undefined,
            server: {
              hostname: opencodeServerHostname.trim() || undefined,
              username: opencodeServerUsername.trim() || undefined,
              password: opencodeServerPassword || undefined,
            },
          },
      },
      { onSuccess: () => showSaved('opencode') }
    )
  }

  const handleSaveClaude = () => {
    mutation.mutate(
      {
        ...agents,
        claude_code: {
          oauth_token: claudeOAuthToken.trim() || undefined,
          model: claudeModel,
        },
      },
      { onSuccess: () => showSaved('claude') }
    )
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

  const opencodeConfigured = !!agents?.opencode?.zen_token
  const claudeConfigured = !!agents?.claude_code?.oauth_token

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <div className="page-header">
          <h1 className="page-title">AI Agents</h1>
          <p className="page-description">Configure AI coding assistants for your workspaces</p>
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
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
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">AI Agents</h1>
        <p className="page-description">Configure AI coding assistants for your workspaces</p>
      </div>

      {/* OpenCode */}
      <div className="agent-row">
        <AgentIcon agentType="opencode" size="md" />
        <div className="agent-info">
          <div className="agent-name">
            OpenCode
            <StatusIndicator configured={opencodeConfigured} />
          </div>
          <p className="agent-description">
            Zen token for OpenCode.
            <a
              href="https://opencode.ai/auth"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
            >
              Get token
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
          <div className="space-y-2 mt-2">
            <div className="agent-input">
              <Input
                type="password"
                value={opencodeZenToken}
                onChange={(e) => {
                  setOpencodeZenToken(e.target.value)
                  setOpencodeHasChanges(true)
                }}
                placeholder="zen_... (Zen token)"
                className="w-full font-mono text-sm h-11 sm:h-9"
              />
            </div>
            <div className="agent-input flex flex-col sm:flex-row gap-2">
              {opencodeModels.length > 0 && (
                <div className="flex-1">
                  <SearchableModelSelect
                    models={opencodeModels}
                    value={opencodeModel}
                    onChange={(value) => {
                      setOpencodeModel(value)
                      setOpencodeHasChanges(true)
                    }}
                    placeholder="Select model..."
                    showProvider
                  />
                </div>
              )}
              <Input
                value={opencodeServerHostname}
                onChange={(e) => {
                  setOpencodeServerHostname(e.target.value)
                  setOpencodeHasChanges(true)
                }}
                placeholder="opencode server hostname (0.0.0.0 or 127.0.0.1)"
                className="w-full sm:w-[260px] font-mono text-sm h-11 sm:h-9"
              />
              <Button
                onClick={handleSaveOpencode}
                disabled={mutation.isPending || !opencodeHasChanges}
                size="sm"
                className="h-11 sm:h-9"
                variant={savedSection === 'opencode' ? 'secondary' : 'default'}
              >
                {savedSection === 'opencode' ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Claude Code */}
      <div className="agent-row">
        <AgentIcon agentType="claude-code" size="md" />
        <div className="agent-info">
          <div className="agent-name">
            Claude Code
            <StatusIndicator configured={claudeConfigured} />
          </div>
          <p className="agent-description">
            OAuth token for headless operation. Run <code className="text-xs bg-secondary px-1 py-0.5 rounded">claude setup-token</code> locally to generate.
          </p>
          <div className="space-y-2 mt-2">
            <div className="agent-input">
              <Input
                type="password"
                value={claudeOAuthToken}
                onChange={(e) => {
                  setClaudeOAuthToken(e.target.value)
                  setClaudeHasChanges(true)
                }}
                placeholder="sk-ant-oat01-... (OAuth token)"
                className="w-full font-mono text-sm h-11 sm:h-9"
              />
            </div>
            <div className="agent-input flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <SearchableModelSelect
                  models={claudeModels}
                  value={claudeModel}
                  onChange={(value) => {
                    setClaudeModel(value)
                    setClaudeHasChanges(true)
                  }}
                  showProvider
                />
              </div>
              <Button
                onClick={handleSaveClaude}
                disabled={mutation.isPending || !claudeHasChanges}
                size="sm"
                className="h-11 sm:h-9"
                variant={savedSection === 'claude' ? 'secondary' : 'default'}
              >
                {savedSection === 'claude' ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Save
                  </>
                )}
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
