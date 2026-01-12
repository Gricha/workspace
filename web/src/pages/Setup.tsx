import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Code2,
  Github,
  Key,
  Check,
  ExternalLink,
  Rocket,
  ArrowRight,
} from 'lucide-react'
import { api, type CodingAgents, type SSHSettings, type ModelInfo } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const FALLBACK_CLAUDE_MODELS: ModelInfo[] = [
  { id: 'sonnet', name: 'Sonnet', description: 'Fast and cost-effective' },
  { id: 'opus', name: 'Opus', description: 'Most capable' },
  { id: 'haiku', name: 'Haiku', description: 'Fastest, lowest cost' },
]

type Step = 'welcome' | 'agents' | 'git' | 'complete'

const STEPS: Step[] = ['welcome', 'agents', 'git', 'complete']

export function Setup() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState<Step>('welcome')

  const [claudeToken, setClaudeToken] = useState('')
  const [claudeModel, setClaudeModel] = useState('sonnet')
  const [opencodeToken, setOpencodeToken] = useState('')
  const [opencodeModel, setOpencodeModel] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [selectedSSHKeys, setSelectedSSHKeys] = useState<string[]>([])

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  })

  const { data: sshSettings } = useQuery({
    queryKey: ['sshSettings'],
    queryFn: api.getSSHSettings,
  })

  const { data: sshKeys } = useQuery({
    queryKey: ['sshKeys'],
    queryFn: api.listSSHKeys,
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

  useEffect(() => {
    if (agents) {
      setClaudeToken(agents.claude_code?.oauth_token || '')
      setClaudeModel(agents.claude_code?.model || 'sonnet')
      setOpencodeToken(agents.opencode?.zen_token || '')
      setOpencodeModel(agents.opencode?.model || '')
      setGithubToken(agents.github?.token || '')
    }
  }, [agents])

  useEffect(() => {
    if (sshSettings) {
      setSelectedSSHKeys(sshSettings.global.copy || [])
    }
  }, [sshSettings])

  const agentsMutation = useMutation({
    mutationFn: (data: CodingAgents) => api.updateAgents(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })

  const sshMutation = useMutation({
    mutationFn: (data: SSHSettings) => api.updateSSHSettings(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sshSettings'] }),
  })

  const handleSaveAgents = async () => {
    await agentsMutation.mutateAsync({
      claude_code: claudeToken ? { oauth_token: claudeToken, model: claudeModel } : undefined,
      opencode: opencodeToken ? { zen_token: opencodeToken, model: opencodeModel || undefined } : undefined,
      github: githubToken ? { token: githubToken } : undefined,
    })
  }

  const handleSaveSSH = async () => {
    if (!sshSettings) return
    await sshMutation.mutateAsync({
      autoAuthorizeHostKeys: sshSettings.autoAuthorizeHostKeys,
      global: {
        copy: selectedSSHKeys,
        authorize: sshSettings.global.authorize || [],
      },
      workspaces: sshSettings.workspaces || {},
    })
  }

  const handleNext = async () => {
    const currentIndex = STEPS.indexOf(currentStep)
    if (currentStep === 'git') {
      await handleSaveAgents()
      await handleSaveSSH()
    }
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1])
    }
  }

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1])
    }
  }

  const handleSkip = () => {
    navigate('/workspaces')
  }

  const handleComplete = () => {
    navigate('/workspaces')
  }

  const toggleSSHKey = (keyPath: string) => {
    if (selectedSSHKeys.includes(keyPath)) {
      setSelectedSSHKeys(selectedSSHKeys.filter(k => k !== keyPath))
    } else {
      setSelectedSSHKeys([...selectedSSHKeys, keyPath])
    }
  }

  const currentStepIndex = STEPS.indexOf(currentStep)
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStep === 'complete'
  const isPending = agentsMutation.isPending || sshMutation.isPending

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              {STEPS.slice(0, -1).map((step, index) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      index < currentStepIndex
                        ? 'bg-primary text-primary-foreground'
                        : index === currentStepIndex
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  {index < STEPS.length - 2 && (
                    <div
                      className={`w-12 h-0.5 mx-1 ${
                        index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip setup
            </Button>
          </div>

          {currentStep === 'welcome' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">Welcome to Perry</h1>
                <p className="text-muted-foreground text-lg">
                  Let's set up your development environment in a few quick steps.
                </p>
              </div>
              <div className="pt-4 space-y-3 text-left max-w-md mx-auto">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">AI Coding Assistants</p>
                    <p className="text-sm text-muted-foreground">Configure Claude Code and OpenCode</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Key className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Git Access</p>
                    <p className="text-sm text-muted-foreground">Set up GitHub and SSH keys</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'agents' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-2">AI Coding Assistants</h1>
                <p className="text-muted-foreground">
                  Configure the AI assistants you want to use. You can set up both!
                </p>
              </div>

              <div className="space-y-4">
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Claude Code</h3>
                      <p className="text-sm text-muted-foreground">
                        Run <code className="text-xs bg-muted px-1 py-0.5 rounded">claude setup-token</code> to get your token
                      </p>
                    </div>
                  </div>
                  <Input
                    type="password"
                    value={claudeToken}
                    onChange={(e) => setClaudeToken(e.target.value)}
                    placeholder="sk-ant-oat01-... (OAuth token)"
                    className="font-mono text-sm"
                  />
                  <div className="flex gap-2">
                    {claudeModels.map((model) => (
                      <Button
                        key={model.id}
                        variant={claudeModel === model.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setClaudeModel(model.id)}
                        className="flex-1"
                      >
                        {model.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Code2 className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">OpenCode</h3>
                      <p className="text-sm text-muted-foreground">
                        Get your token from{' '}
                        <a
                          href="https://opencode.ai/auth"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          opencode.ai
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    </div>
                  </div>
                  <Input
                    type="password"
                    value={opencodeToken}
                    onChange={(e) => setOpencodeToken(e.target.value)}
                    placeholder="zen_... (Zen token)"
                    className="font-mono text-sm"
                  />
                  {opencodeModels.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {opencodeModels.map((model) => (
                        <Button
                          key={model.id}
                          variant={opencodeModel === model.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setOpencodeModel(model.id)}
                        >
                          {model.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 'git' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-2">Git Access</h1>
                <p className="text-muted-foreground">
                  Configure GitHub and SSH keys for repository access
                </p>
              </div>

              <div className="space-y-4">
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
                      <Github className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">GitHub Token</h3>
                      <p className="text-sm text-muted-foreground">
                        Personal Access Token for git operations.{' '}
                        <a
                          href="https://github.com/settings/personal-access-tokens/new"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Create token
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    </div>
                  </div>
                  <Input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_... or github_pat_..."
                    className="font-mono text-sm"
                  />
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Key className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold">SSH Keys</h3>
                      <p className="text-sm text-muted-foreground">
                        Copy SSH keys to workspaces for git operations
                      </p>
                    </div>
                  </div>

                  {sshKeys && sshKeys.filter(k => k.hasPrivateKey).length > 0 ? (
                    <div className="space-y-2">
                      {sshKeys.filter(k => k.hasPrivateKey).map((key) => (
                        <div
                          key={key.path}
                          className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => toggleSSHKey(key.path)}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            selectedSSHKeys.includes(key.path)
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/30'
                          }`}>
                            {selectedSSHKeys.includes(key.path) && <Check className="h-3 w-3 text-primary-foreground" />}
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
                    <div className="border border-dashed border-muted-foreground/20 rounded-lg p-6 text-center">
                      <Key className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No SSH keys found in ~/.ssh/</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">You're all set!</h1>
                <p className="text-muted-foreground text-lg">
                  Perry is ready to use. Create your first workspace to get started.
                </p>
              </div>
              <div className="pt-4 space-y-3 text-left max-w-md mx-auto text-sm">
                {(claudeToken || opencodeToken) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>
                      AI Assistants: {[claudeToken && 'Claude Code', opencodeToken && 'OpenCode'].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {githubToken && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>GitHub token configured</span>
                  </div>
                )}
                {selectedSSHKeys.length > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{selectedSSHKeys.length} SSH key{selectedSSHKeys.length > 1 ? 's' : ''} selected</span>
                  </div>
                )}
                {!claudeToken && !opencodeToken && !githubToken && selectedSSHKeys.length === 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>No configuration added. You can always configure later in Settings.</span>
                  </div>
                )}
              </div>
              <div className="pt-4">
                <a
                  href="https://gricha.github.io/perry/getting-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  Read the documentation
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t">
            <div>
              {!isFirstStep && !isLastStep && (
                <Button variant="ghost" onClick={handleBack} disabled={isPending}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
              )}
            </div>
            <div>
              {isLastStep ? (
                <Button onClick={handleComplete} size="lg">
                  Create your first workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleNext} disabled={isPending}>
                  {currentStep === 'welcome' ? "Let's go" : 'Continue'}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
