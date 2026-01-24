import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import crypto from 'crypto';
import { loadAgentConfig, saveAgentConfig, getConfigDir, ensureConfigDir } from '../config/loader';
import { discoverSSHKeys } from '../ssh';
import type { SSHKeyInfo } from '../shared/client-types';

type Step = 'welcome' | 'auth' | 'github' | 'ssh' | 'tailscale' | 'complete';

const STEPS: Step[] = ['welcome', 'auth', 'github', 'ssh', 'tailscale', 'complete'];

interface WizardState {
  authToken: string;
  authTokenGenerated: boolean;
  githubToken: string;
  selectedSSHKeys: string[];
  tailscaleAuthKey: string;
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  useInput((input, key) => {
    if (key.return || input === ' ') {
      onNext();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Welcome to Perry Setup
        </Text>
      </Box>
      <Text>This wizard will help you configure:</Text>
      <Box marginLeft={2} flexDirection="column">
        <Text>• API security (auth token)</Text>
        <Text>• Git access (GitHub token)</Text>
        <Text>• SSH keys for workspaces</Text>
        <Text>• Tailscale networking</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="gray">Press Enter to continue...</Text>
      </Box>
    </Box>
  );
}

function TokenInputStep({
  title,
  placeholder,
  helpText,
  value,
  onChange,
  onNext,
  onBack,
  optional,
}: {
  title: string;
  placeholder: string;
  helpText: string;
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  optional?: boolean;
}) {
  const [showValue, setShowValue] = useState(false);

  useInput((input, key) => {
    if (key.return) {
      onNext();
    } else if (key.escape) {
      onBack();
    } else if (input === 'v' && key.ctrl) {
      setShowValue((s) => !s);
    } else if (input === 's' && optional) {
      onNext();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text bold>{title}</Text>
        {optional && <Text color="gray"> (optional)</Text>}
      </Box>
      <Text color="gray">{helpText}</Text>
      <Box marginTop={1}>
        <Text>Token: </Text>
        <TextInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          mask={showValue ? undefined : '*'}
        />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">
          Enter to continue, Esc to go back{optional ? ', S to skip' : ''}, Ctrl+V to toggle
        </Text>
      </Box>
    </Box>
  );
}

function AuthStep({
  token,
  isNew,
  onGenerate,
  onNext,
  onBack,
}: {
  token: string;
  isNew: boolean;
  onGenerate: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [showToken, setShowToken] = useState(false);

  useInput((input, key) => {
    if (key.return) {
      onNext();
    } else if (key.escape) {
      onBack();
    } else if (input === 'g' && !token) {
      onGenerate();
    } else if (input === 'v' && key.ctrl) {
      setShowToken((s) => !s);
    }
  });

  const maskedToken = token ? `${token.slice(0, 10)}...${token.slice(-4)}` : '';

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>API Security</Text>
      <Text color="gray">
        Secure your Perry agent with token authentication. Clients will need this token to connect.
      </Text>

      <Box marginTop={1} flexDirection="column">
        {token ? (
          <>
            <Box>
              <Text color="green">✓ </Text>
              <Text>Auth token {isNew ? 'generated' : 'configured'}</Text>
            </Box>
            <Box marginTop={1}>
              <Text>Token: </Text>
              <Text color="cyan">{showToken ? token : maskedToken}</Text>
            </Box>
            <Box marginTop={1} flexDirection="column">
              <Text color="yellow">Save this token! You'll need it to configure clients:</Text>
              <Box marginLeft={2}>
                <Text color="gray">CLI: perry config token {showToken ? token : '<token>'}</Text>
              </Box>
              <Box marginLeft={2}>
                <Text color="gray">Web: Enter when prompted on first visit</Text>
              </Box>
            </Box>
          </>
        ) : (
          <>
            <Text color="yellow">No auth token configured.</Text>
            <Text>Without a token, anyone with network access can control your agent.</Text>
          </>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">
          {token ? 'Ctrl+V to show/hide token, ' : 'G to generate token, '}
          Enter to continue, Esc to go back
        </Text>
      </Box>
    </Box>
  );
}

function SSHKeySelectStep({
  keys,
  selected,
  onToggle,
  onNext,
  onBack,
}: {
  keys: SSHKeyInfo[];
  selected: string[];
  onToggle: (path: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const privateKeys = keys.filter((k) => k.hasPrivateKey);
  const [highlighted, setHighlighted] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setHighlighted((h) => Math.max(0, h - 1));
    } else if (key.downArrow) {
      setHighlighted((h) => Math.min(privateKeys.length - 1, h + 1));
    } else if (input === ' ' && privateKeys.length > 0) {
      onToggle(privateKeys[highlighted].path);
    } else if (key.return) {
      onNext();
    } else if (key.escape) {
      onBack();
    }
  });

  if (privateKeys.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>SSH Keys</Text>
        <Text color="yellow">No SSH keys found in ~/.ssh/</Text>
        <Text color="gray">You can generate keys with: ssh-keygen -t ed25519</Text>
        <Box marginTop={1}>
          <Text color="gray">Enter to continue, Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Select SSH keys to copy to workspaces</Text>
      <Text color="gray">These keys will be available inside workspaces for git operations</Text>
      <Box flexDirection="column" marginTop={1}>
        {privateKeys.map((sshKey, index) => (
          <Box key={sshKey.path}>
            <Text color={highlighted === index ? 'cyan' : undefined}>
              <Text color={selected.includes(sshKey.path) ? 'green' : 'gray'}>
                {selected.includes(sshKey.path) ? '[x]' : '[ ]'}
              </Text>
              <Text> {sshKey.name}</Text>
              <Text color="gray"> ({sshKey.type.toUpperCase()})</Text>
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color="gray">Space to toggle, Enter to continue (or skip), Esc to go back</Text>
      </Box>
    </Box>
  );
}

function CompleteStep({ state, onFinish }: { state: WizardState; onFinish: () => void }) {
  useInput((_input, key) => {
    if (key.return) {
      onFinish();
    }
  });

  const configured: string[] = [];
  if (state.authToken) configured.push('Auth token');
  if (state.githubToken) configured.push('GitHub');
  if (state.selectedSSHKeys.length > 0)
    configured.push(`${state.selectedSSHKeys.length} SSH key(s)`);
  if (state.tailscaleAuthKey) configured.push('Tailscale');

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="green">
        Setup Complete!
      </Text>
      {configured.length > 0 ? (
        <Box flexDirection="column">
          <Text>Configured:</Text>
          {configured.map((item, idx) => (
            <Text key={idx} color="green">
              • {item}
            </Text>
          ))}
        </Box>
      ) : (
        <Text color="yellow">No configuration added. You can always configure later.</Text>
      )}
      {state.authToken && (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">Remember to configure your clients with the auth token:</Text>
          <Box marginLeft={2}>
            <Text color="gray">perry config token {'<token>'}</Text>
          </Box>
        </Box>
      )}
      <Box marginTop={1}>
        <Text>Start the agent with: </Text>
        <Text color="cyan">perry agent run</Text>
      </Box>
      <Box>
        <Text>Open the web UI at: </Text>
        <Text color="cyan">http://localhost:7391</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="gray">Press Enter to exit...</Text>
      </Box>
    </Box>
  );
}

function SetupWizard() {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [sshKeys, setSSHKeys] = useState<SSHKeyInfo[]>([]);
  const [state, setState] = useState<WizardState>({
    authToken: '',
    authTokenGenerated: false,
    githubToken: '',
    selectedSSHKeys: [],
    tailscaleAuthKey: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    discoverSSHKeys()
      .then(setSSHKeys)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const loadExisting = async () => {
      const configDir = getConfigDir();
      await ensureConfigDir(configDir);
      const config = await loadAgentConfig(configDir);
      setState((s) => ({
        ...s,
        authToken: config.auth?.token || '',
        authTokenGenerated: false,
        githubToken: config.agents?.github?.token || '',
        selectedSSHKeys: config.ssh?.global.copy || [],
        tailscaleAuthKey: config.tailscale?.authKey || '',
      }));
    };
    loadExisting().catch(() => {});
  }, []);

  const nextStep = () => {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1]);
    }
  };

  const toggleSSHKey = (path: string) => {
    setState((s) => ({
      ...s,
      selectedSSHKeys: s.selectedSSHKeys.includes(path)
        ? s.selectedSSHKeys.filter((k) => k !== path)
        : [...s.selectedSSHKeys, path],
    }));
  };

  const generateAuthToken = () => {
    const token = `perry-${crypto.randomBytes(16).toString('hex')}`;
    setState((s) => ({
      ...s,
      authToken: token,
      authTokenGenerated: true,
    }));
  };

  const saveAndFinish = async () => {
    setSaving(true);
    try {
      const configDir = getConfigDir();
      await ensureConfigDir(configDir);
      const config = await loadAgentConfig(configDir);

      if (state.authTokenGenerated && state.authToken) {
        config.auth = { ...config.auth, token: state.authToken };
      }

      if (state.githubToken) {
        config.agents = {
          ...config.agents,
          github: { token: state.githubToken },
        };
      }

      if (state.selectedSSHKeys.length > 0) {
        config.ssh = {
          ...config.ssh!,
          global: {
            ...config.ssh!.global,
            copy: state.selectedSSHKeys,
          },
        };
      }

      if (state.tailscaleAuthKey) {
        config.tailscale = {
          ...config.tailscale,
          enabled: true,
          authKey: state.tailscaleAuthKey,
        };
      }

      await saveAgentConfig(config, configDir);
    } catch {
      // Ignore save errors - user can reconfigure later
    } finally {
      setSaving(false);
      exit();
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {'  ____  _____ ____  ______   __\n'}
          {' |  _ \\| ____|  _ \\|  _ \\ \\ / /\n'}
          {' | |_) |  _| | |_) | |_) \\ V /\n'}
          {' |  __/| |___|  _ <|  _ < | |\n'}
          {' |_|   |_____|_| \\_\\_| \\_\\|_|\n'}
        </Text>
      </Box>

      {saving ? (
        <Text color="yellow">Saving configuration...</Text>
      ) : (
        <>
          {step === 'welcome' && <WelcomeStep onNext={nextStep} />}
          {step === 'auth' && (
            <AuthStep
              token={state.authToken}
              isNew={state.authTokenGenerated}
              onGenerate={generateAuthToken}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {step === 'github' && (
            <TokenInputStep
              title="GitHub Personal Access Token"
              placeholder="ghp_... or github_pat_..."
              helpText="Create at https://github.com/settings/personal-access-tokens/new"
              value={state.githubToken}
              onChange={(v) => setState((s) => ({ ...s, githubToken: v }))}
              onNext={nextStep}
              onBack={prevStep}
              optional
            />
          )}
          {step === 'ssh' && (
            <SSHKeySelectStep
              keys={sshKeys}
              selected={state.selectedSSHKeys}
              onToggle={toggleSSHKey}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {step === 'tailscale' && (
            <TokenInputStep
              title="Tailscale Auth Key"
              placeholder="tskey-auth-..."
              helpText="Generate at https://login.tailscale.com/admin/settings/keys (Reusable: Yes, Ephemeral: No)"
              value={state.tailscaleAuthKey}
              onChange={(v) => setState((s) => ({ ...s, tailscaleAuthKey: v }))}
              onNext={nextStep}
              onBack={prevStep}
              optional
            />
          )}
          {step === 'complete' && (
            <CompleteStep
              state={state}
              onFinish={() => {
                void saveAndFinish();
              }}
            />
          )}
        </>
      )}
    </Box>
  );
}

export async function runSetupWizard(): Promise<void> {
  const { waitUntilExit } = render(<SetupWizard />);
  await waitUntilExit();
}
