import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { loadAgentConfig, saveAgentConfig, getConfigDir, ensureConfigDir } from '../config/loader';
import { discoverSSHKeys } from '../ssh';
import type { SSHKeyInfo } from '../shared/client-types';

type Step =
  | 'welcome'
  | 'agents'
  | 'claude'
  | 'opencode'
  | 'github'
  | 'ssh'
  | 'tailscale'
  | 'complete';
type AgentId = 'claude' | 'opencode';

const STEPS: Step[] = [
  'welcome',
  'agents',
  'claude',
  'opencode',
  'github',
  'ssh',
  'tailscale',
  'complete',
];

interface WizardState {
  selectedAgents: AgentId[];
  claudeToken: string;
  claudeModel: string;
  opencodeToken: string;
  opencodeModel: string;
  githubToken: string;
  selectedSSHKeys: string[];
  tailscaleAuthKey: string;
}

function SelectableItem({
  selected,
  highlighted,
  label,
  description,
}: {
  selected: boolean;
  highlighted: boolean;
  label: string;
  description?: string;
}) {
  return (
    <Box>
      <Text color={highlighted ? 'cyan' : undefined}>
        <Text color={selected ? 'green' : 'gray'}>{selected ? '[x]' : '[ ]'}</Text>
        <Text> {label}</Text>
        {description && <Text color="gray"> - {description}</Text>}
      </Text>
    </Box>
  );
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
        <Text>• AI coding assistants (Claude Code, OpenCode)</Text>
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

function AgentSelectStep({
  selected,
  onToggle,
  onNext,
}: {
  selected: AgentId[];
  onToggle: (agent: AgentId) => void;
  onNext: () => void;
}) {
  const [highlighted, setHighlighted] = useState(0);
  const agents: { id: AgentId; name: string; description: string }[] = [
    { id: 'claude', name: 'Claude Code', description: 'Anthropic AI assistant' },
    { id: 'opencode', name: 'OpenCode', description: 'Open source AI coding assistant' },
  ];

  useInput((input, key) => {
    if (key.upArrow) {
      setHighlighted((h: number) => Math.max(0, h - 1));
    } else if (key.downArrow) {
      setHighlighted((h: number) => Math.min(agents.length - 1, h + 1));
    } else if (input === ' ') {
      onToggle(agents[highlighted].id);
    } else if (key.return) {
      onNext();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Which AI assistants do you want to use?</Text>
      <Text color="gray">Space to toggle, Enter to continue</Text>
      <Box flexDirection="column" marginTop={1}>
        {agents.map((agent, index) => (
          <SelectableItem
            key={agent.id}
            selected={selected.includes(agent.id)}
            highlighted={highlighted === index}
            label={agent.name}
            description={agent.description}
          />
        ))}
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
      setShowValue((s: boolean) => !s);
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
      setHighlighted((h: number) => Math.max(0, h - 1));
    } else if (key.downArrow) {
      setHighlighted((h: number) => Math.min(privateKeys.length - 1, h + 1));
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
  if (state.claudeToken) configured.push('Claude Code');
  if (state.opencodeToken) configured.push('OpenCode');
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
    selectedAgents: [],
    claudeToken: '',
    claudeModel: 'sonnet',
    opencodeToken: '',
    opencodeModel: '',
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
      setState((s: WizardState) => ({
        ...s,
        claudeToken: config.agents?.claude_code?.oauth_token || '',
        claudeModel: config.agents?.claude_code?.model || 'sonnet',
        opencodeToken: config.agents?.opencode?.zen_token || '',
        opencodeModel: config.agents?.opencode?.model || '',
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
      let nextIndex = currentIndex + 1;
      if (STEPS[nextIndex] === 'claude' && !state.selectedAgents.includes('claude')) {
        nextIndex++;
      }
      if (STEPS[nextIndex] === 'opencode' && !state.selectedAgents.includes('opencode')) {
        nextIndex++;
      }
      setStep(STEPS[nextIndex]);
    }
  };

  const prevStep = () => {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex > 0) {
      let prevIndex = currentIndex - 1;
      if (STEPS[prevIndex] === 'opencode' && !state.selectedAgents.includes('opencode')) {
        prevIndex--;
      }
      if (STEPS[prevIndex] === 'claude' && !state.selectedAgents.includes('claude')) {
        prevIndex--;
      }
      setStep(STEPS[prevIndex]);
    }
  };

  const toggleAgent = (agent: AgentId) => {
    setState((s: WizardState) => ({
      ...s,
      selectedAgents: s.selectedAgents.includes(agent)
        ? s.selectedAgents.filter((a: AgentId) => a !== agent)
        : [...s.selectedAgents, agent],
    }));
  };

  const toggleSSHKey = (path: string) => {
    setState((s: WizardState) => ({
      ...s,
      selectedSSHKeys: s.selectedSSHKeys.includes(path)
        ? s.selectedSSHKeys.filter((k: string) => k !== path)
        : [...s.selectedSSHKeys, path],
    }));
  };

  const saveAndFinish = async () => {
    setSaving(true);
    try {
      const configDir = getConfigDir();
      await ensureConfigDir(configDir);
      const config = await loadAgentConfig(configDir);

      if (state.claudeToken || state.opencodeToken || state.githubToken) {
        config.agents = {
          ...config.agents,
          claude_code: state.claudeToken
            ? { oauth_token: state.claudeToken, model: state.claudeModel }
            : config.agents?.claude_code,
          opencode: state.opencodeToken
            ? { zen_token: state.opencodeToken, model: state.opencodeModel || undefined }
            : config.agents?.opencode,
          github: state.githubToken ? { token: state.githubToken } : config.agents?.github,
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
          {step === 'agents' && (
            <AgentSelectStep
              selected={state.selectedAgents}
              onToggle={toggleAgent}
              onNext={nextStep}
            />
          )}
          {step === 'claude' && (
            <TokenInputStep
              title="Claude Code Token"
              placeholder="sk-ant-oat01-..."
              helpText="Run 'claude setup-token' locally to generate this token"
              value={state.claudeToken}
              onChange={(v: string) => setState((s: WizardState) => ({ ...s, claudeToken: v }))}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}
          {step === 'opencode' && (
            <TokenInputStep
              title="OpenCode Token"
              placeholder="zen_..."
              helpText="Get your token from https://opencode.ai/auth"
              value={state.opencodeToken}
              onChange={(v: string) => setState((s: WizardState) => ({ ...s, opencodeToken: v }))}
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
              onChange={(v: string) => setState((s: WizardState) => ({ ...s, githubToken: v }))}
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
              onChange={(v: string) =>
                setState((s: WizardState) => ({ ...s, tailscaleAuthKey: v }))
              }
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
