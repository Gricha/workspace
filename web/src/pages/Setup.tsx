import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Github,
  Key,
  Check,
  ExternalLink,
  Rocket,
  ArrowRight,
  Network,
  Shield,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { api, type CodingAgents, type SSHSettings } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
type Step = 'welcome' | 'security' | 'git' | 'networking' | 'complete';

const STEPS: Step[] = ['welcome', 'security', 'git', 'networking', 'complete'];

export function Setup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<Step>('welcome');

  const [githubToken, setGithubToken] = useState('');
  const [selectedSSHKeys, setSelectedSSHKeys] = useState<string[]>([]);
  const [tailscaleEnabled, setTailscaleEnabled] = useState(false);
  const [tailscaleAuthKey, setTailscaleAuthKey] = useState('');

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  });

  const { data: sshSettings } = useQuery({
    queryKey: ['sshSettings'],
    queryFn: api.getSSHSettings,
  });

  const { data: sshKeys } = useQuery({
    queryKey: ['sshKeys'],
    queryFn: api.listSSHKeys,
  });

  const { data: tailscaleConfig } = useQuery({
    queryKey: ['tailscaleConfig'],
    queryFn: api.getTailscaleConfig,
  });

  const { data: authConfig, refetch: refetchAuth } = useQuery({
    queryKey: ['authConfig'],
    queryFn: api.getAuthConfig,
  });

  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const handleGenerateToken = async () => {
    setIsGenerating(true);
    try {
      const result = await api.generateAuthToken();
      setGeneratedToken(result.token);
      await refetchAuth();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToken = async () => {
    if (generatedToken) {
      await navigator.clipboard.writeText(generatedToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (agents) {
      setGithubToken(agents.github?.token || '');
    }
  }, [agents]);

  useEffect(() => {
    if (sshSettings) {
      setSelectedSSHKeys(sshSettings.global.copy || []);
    }
  }, [sshSettings]);

  useEffect(() => {
    if (tailscaleConfig) {
      setTailscaleEnabled(tailscaleConfig.enabled);
      setTailscaleAuthKey(tailscaleConfig.authKey || '');
    }
  }, [tailscaleConfig]);

  const agentsMutation = useMutation({
    mutationFn: (data: CodingAgents) => api.updateAgents(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const sshMutation = useMutation({
    mutationFn: (data: SSHSettings) => api.updateSSHSettings(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sshSettings'] }),
  });

  const tailscaleMutation = useMutation({
    mutationFn: (config: { enabled?: boolean; authKey?: string }) =>
      api.updateTailscaleConfig(config),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tailscaleConfig'] }),
  });

  const handleSaveAgents = async () => {
    await agentsMutation.mutateAsync({
      ...(agents ?? {}),
      github: githubToken ? { token: githubToken } : agents?.github,
    });
  };

  const handleSaveSSH = async () => {
    if (!sshSettings) return;
    await sshMutation.mutateAsync({
      autoAuthorizeHostKeys: sshSettings.autoAuthorizeHostKeys,
      global: {
        copy: selectedSSHKeys,
        authorize: sshSettings.global.authorize || [],
      },
      workspaces: sshSettings.workspaces || {},
    });
  };

  const handleSaveTailscale = async () => {
    if (tailscaleEnabled && tailscaleAuthKey) {
      await tailscaleMutation.mutateAsync({
        enabled: tailscaleEnabled,
        authKey: tailscaleAuthKey,
      });
    }
  };

  const handleNext = async () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentStep === 'git') {
      await Promise.all([handleSaveAgents(), handleSaveSSH()]);
    }
    if (currentStep === 'networking') {
      await handleSaveTailscale();
    }
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    }
  };

  const handleSkip = () => {
    navigate('/workspaces');
  };

  const handleComplete = () => {
    navigate('/workspaces');
  };

  const toggleSSHKey = (keyPath: string) => {
    setSelectedSSHKeys((current) =>
      current.includes(keyPath) ? current.filter((k) => k !== keyPath) : [...current, keyPath]
    );
  };

  const currentStepIndex = STEPS.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStep === 'complete';
  const isPending = agentsMutation.isPending || sshMutation.isPending || tailscaleMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto">
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
                <Shield className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Security</p>
                <p className="text-sm text-muted-foreground">Configure API authentication</p>
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
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Network className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Networking</p>
                <p className="text-sm text-muted-foreground">Connect workspaces to your tailnet</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'security' && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">API Security</h1>
            <p className="text-muted-foreground">
              Manage authentication for CLI and other clients
            </p>
          </div>

          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Auth Token</h3>
                  <p className="text-sm text-muted-foreground">
                    {authConfig?.hasToken
                      ? 'Token configured - clients need this to connect'
                      : 'No token configured - API is open'}
                  </p>
                </div>
              </div>

              {authConfig?.hasToken && !generatedToken && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-2">
                    Current token: <code className="bg-muted px-1 rounded">{authConfig.tokenPreview}</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Run <code className="bg-muted px-1 rounded">perry agent config</code> on the agent to view the full token.
                  </p>
                </div>
              )}

              {generatedToken && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                    New token generated!
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-2 py-1 rounded text-sm font-mono break-all">
                      {generatedToken}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyToken}
                      className="flex-shrink-0"
                    >
                      {tokenCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Save this token! Configure CLI clients with: <code className="bg-muted px-1 rounded">perry config token {'<token>'}</code>
                  </p>
                </div>
              )}

              {!generatedToken && (
                <Button
                  variant="outline"
                  onClick={handleGenerateToken}
                  disabled={isGenerating}
                  className="w-full"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                  {authConfig?.hasToken ? 'Generate New Token' : 'Generate Token'}
                </Button>
              )}
            </div>

            <div className="p-4 rounded-lg border bg-muted/30">
              <h4 className="font-medium mb-2 text-sm">About Authentication</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Tokens protect your agent from unauthorized access</li>
                <li>• CLI clients need the token to connect remotely</li>
                <li>• Web clients store the token in browser storage</li>
                <li>• Tailscale users are authenticated automatically</li>
              </ul>
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

              {sshKeys && sshKeys.filter((k) => k.hasPrivateKey).length > 0 ? (
                <div className="space-y-2">
                  {sshKeys
                    .filter((k) => k.hasPrivateKey)
                    .map((key) => (
                      <div
                        key={key.path}
                        className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleSSHKey(key.path)}
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            selectedSSHKeys.includes(key.path)
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {selectedSSHKeys.includes(key.path) && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
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

      {currentStep === 'networking' && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Networking</h1>
            <p className="text-muted-foreground">
              Connect workspaces to your Tailscale network (optional)
            </p>
          </div>

          <div className="space-y-4">
            <div
              className={`border rounded-lg overflow-hidden transition-colors ${tailscaleEnabled ? 'border-blue-500' : ''}`}
            >
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setTailscaleEnabled(!tailscaleEnabled)}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    tailscaleEnabled ? 'bg-blue-500 border-blue-500' : 'border-muted-foreground/30'
                  }`}
                >
                  {tailscaleEnabled && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Network className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Tailscale</h3>
                  <p className="text-sm text-muted-foreground">
                    Access workspaces from any device on your tailnet
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${tailscaleEnabled ? 'rotate-180' : ''}`}
                />
              </div>
              {tailscaleEnabled && (
                <div className="px-4 pb-4 space-y-3 border-t bg-muted/30">
                  <div className="pt-3">
                    <p className="text-sm text-muted-foreground mb-2">
                      Generate an auth key from the{' '}
                      <a
                        href="https://login.tailscale.com/admin/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Tailscale admin console
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                    <Input
                      type="password"
                      value={tailscaleAuthKey}
                      onChange={(e) => setTailscaleAuthKey(e.target.value)}
                      placeholder="tskey-auth-..."
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Recommended settings when generating the key:</p>
                    <ul className="list-disc list-inside ml-2">
                      <li>Reusable: Yes</li>
                      <li>Ephemeral: No</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-lg border bg-muted/30">
              <h4 className="font-medium mb-2 text-sm">What does this enable?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  • Access workspaces by hostname:{' '}
                  <code className="bg-muted px-1 rounded text-xs">http://perry-myworkspace:3000</code>
                </li>
                <li>
                  • SSH directly:{' '}
                  <code className="bg-muted px-1 rounded text-xs">ssh workspace@perry-myworkspace</code>
                </li>
                <li>• Works from any device on your tailnet</li>
              </ul>
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
            {authConfig?.hasToken && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-green-500" />
                <span>Auth token configured</span>
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
                <span>
                  {selectedSSHKeys.length} SSH key{selectedSSHKeys.length > 1 ? 's' : ''} selected
                </span>
              </div>
            )}
            {tailscaleEnabled && tailscaleAuthKey && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-green-500" />
                <span>Tailscale networking enabled</span>
              </div>
            )}
            {!authConfig?.hasToken && !githubToken && selectedSSHKeys.length === 0 && !tailscaleAuthKey && (
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
  );
}
