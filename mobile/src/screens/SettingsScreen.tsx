import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  CodingAgents,
  Credentials,
  Scripts,
  SyncResult,
  ModelInfo,
  getBaseUrl,
  saveServerConfig,
  getDefaultPort,
  refreshClient,
} from '../lib/api';
import { useNetwork, parseNetworkError } from '../lib/network';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeId } from '../lib/themes';

function ScreenWrapper({ title, navigation, children }: { title: string; navigation: any; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.accent }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SettingRow({
  label,
  value,
  placeholder,
  onChangeText,
  secureTextEntry,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const FALLBACK_CLAUDE_MODELS: ModelInfo[] = [
  { id: 'sonnet', name: 'Sonnet', description: 'Fast and cost-effective' },
  { id: 'opus', name: 'Opus', description: 'Most capable' },
  { id: 'haiku', name: 'Haiku', description: 'Fastest, lowest cost' },
];

function ModelPicker({
  label,
  models,
  selectedModel,
  onSelect,
}: {
  label: string;
  models: ModelInfo[];
  selectedModel: string;
  onSelect: (model: string) => void;
}) {
  const { colors } = useTheme();
  const selectedModelInfo = models.find((m) => m.id === selectedModel);

  const showPicker = () => {
    const options = [...models.map((m) => m.name), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        title: 'Select Model',
      },
      (buttonIndex) => {
        if (buttonIndex < models.length) {
          onSelect(models[buttonIndex].id);
        }
      }
    );
  };

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TouchableOpacity style={[styles.modelPicker, { backgroundColor: colors.surfaceSecondary }]} onPress={showPicker}>
        <Text style={[styles.modelPickerText, { color: colors.text }]}>{selectedModelInfo?.name || 'Select Model'}</Text>
        <Text style={[styles.modelPickerChevron, { color: colors.textMuted }]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

function NavigationRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.navRow, { backgroundColor: colors.surface }]}
      onPress={onPress}
    >
      <View style={styles.navRowContent}>
        <Text style={[styles.navRowTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.navRowSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Text style={[styles.navRowChevron, { color: colors.textMuted }]}>›</Text>
    </TouchableOpacity>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {children}
    </View>
  );
}

export function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { status } = useNetwork();
  const { data: info } = useQuery({
    queryKey: ['info'],
    queryFn: api.getInfo,
    retry: false,
  });

  const isConnected = status === 'connected';

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.accent }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <ScrollView contentContainerStyle={[styles.indexContent, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>General</Text>
          <View style={styles.navGroup}>
            <NavigationRow
              title="Connection"
              subtitle={isConnected ? info?.hostname : 'Not connected'}
              onPress={() => navigation.navigate('SettingsConnection')}
            />
            <NavigationRow
              title="Appearance"
              subtitle="Theme"
              onPress={() => navigation.navigate('SettingsTheme')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Workspace</Text>
          <View style={styles.navGroup}>
            <NavigationRow
              title="Environment"
              subtitle="Environment variables"
              onPress={() => navigation.navigate('SettingsEnvironment')}
            />
            <NavigationRow
              title="Files"
              subtitle="SSH keys, configs"
              onPress={() => navigation.navigate('SettingsFiles')}
            />
            <NavigationRow
              title="Scripts"
              subtitle="Post-start hooks"
              onPress={() => navigation.navigate('SettingsScripts')}
            />
            <NavigationRow
              title="Sync"
              subtitle="Push to all workspaces"
              onPress={() => navigation.navigate('SettingsSync')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Integrations</Text>
          <View style={styles.navGroup}>
            <NavigationRow
              title="AI Agents"
              subtitle="Claude Code, OpenCode"
              onPress={() => navigation.navigate('SettingsAgents')}
            />
            <NavigationRow
              title="GitHub"
              subtitle="Personal access token"
              onPress={() => navigation.navigate('SettingsGitHub')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.navGroup}>
            <NavigationRow
              title="Skills"
              subtitle="SKILL.md files"
              onPress={() => navigation.navigate('Skills')}
            />
            <NavigationRow
              title="MCP Servers"
              subtitle="Model Context Protocol"
              onPress={() => navigation.navigate('Mcp')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Info</Text>
          <View style={styles.navGroup}>
            <NavigationRow
              title="About"
              subtitle={isConnected ? 'Connected' : 'Disconnected'}
              onPress={() => navigation.navigate('SettingsAbout')}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export function ConnectionSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const currentUrl = getBaseUrl();
  const urlMatch = currentUrl.match(/^https?:\/\/([^:]+):(\d+)$/);
  const [host, setHost] = useState(urlMatch?.[1] || '');
  const [port, setPort] = useState(urlMatch?.[2] || String(getDefaultPort()));
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    const trimmedHost = host.trim();
    if (!trimmedHost) {
      Alert.alert('Error', 'Please enter a hostname');
      return;
    }
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Alert.alert('Error', 'Please enter a valid port number');
      return;
    }

    setIsSaving(true);
    try {
      await saveServerConfig(trimmedHost, portNum);
      refreshClient();
      queryClient.invalidateQueries();
      setHasChanges(false);
      Alert.alert('Success', 'Server settings updated');
    } catch {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenWrapper title="Connection" navigation={navigation}>
      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Agent Server</Text>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          Hostname and port of the workspace agent
        </Text>
        <SettingRow
          label="Hostname"
          value={host}
          placeholder="my-server.tailnet.ts.net"
          onChangeText={(t) => {
            setHost(t);
            setHasChanges(true);
          }}
        />
        <SettingRow
          label="Port"
          value={port}
          placeholder={String(getDefaultPort())}
          onChangeText={(t) => {
            setPort(t);
            setHasChanges(true);
          }}
        />
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.accent }, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Update Server</Text>
          )}
        </TouchableOpacity>
      </Card>
    </ScreenWrapper>
  );
}

export function ThemeSettingsScreen({ navigation }: any) {
  const { themeId, setTheme, definitions, colors } = useTheme();

  return (
    <ScreenWrapper title="Appearance" navigation={navigation}>
      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Theme</Text>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          Choose your preferred color scheme
        </Text>
        <View style={styles.themeList}>
          {definitions.map((theme) => (
            <TouchableOpacity
              key={theme.id}
              style={[
                styles.themeItem,
                { backgroundColor: colors.surfaceSecondary },
                themeId === theme.id && { borderColor: colors.accent, borderWidth: 2 },
              ]}
              onPress={() => setTheme(theme.id as ThemeId)}
            >
              <View style={[styles.themePreviewDot, { backgroundColor: theme.preview.accent }]} />
              <View style={styles.themeItemContent}>
                <Text style={[styles.themeItemName, { color: colors.text }]}>{theme.name}</Text>
                <Text style={[styles.themeItemDescription, { color: colors.textMuted }]}>
                  {theme.description}
                </Text>
              </View>
              {themeId === theme.id && (
                <Text style={[styles.themeCheckmark, { color: colors.accent }]}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Card>
    </ScreenWrapper>
  );
}

export function AgentsSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  });

  const { data: claudeModelsData } = useQuery({
    queryKey: ['models', 'claude-code'],
    queryFn: () => api.listModels('claude-code'),
  });

  const { data: opencodeModelsData } = useQuery({
    queryKey: ['models', 'opencode'],
    queryFn: () => api.listModels('opencode'),
  });

  const claudeModels = claudeModelsData?.models?.length
    ? claudeModelsData.models
    : FALLBACK_CLAUDE_MODELS;
  const opencodeModels = opencodeModelsData?.models || [];

  const [opencodeZenToken, setOpencodeZenToken] = useState('');
  const [opencodeModel, setOpencodeModel] = useState('');
  const [claudeOAuthToken, setClaudeOAuthToken] = useState('');
  const [claudeModel, setClaudeModel] = useState('sonnet');
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (agents && !initialized) {
      setOpencodeZenToken(agents.opencode?.zen_token || '');
      setOpencodeModel(agents.opencode?.model || '');
      setClaudeOAuthToken(agents.claude_code?.oauth_token || '');
      setClaudeModel(agents.claude_code?.model || 'sonnet');
      setInitialized(true);
    }
  }, [agents, initialized]);

  const mutation = useMutation({
    mutationFn: (data: CodingAgents) => api.updateAgents(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setHasChanges(false);
      Alert.alert('Success', 'Settings saved');
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err));
    },
  });

  const handleSave = () => {
    mutation.mutate({
      opencode: {
        zen_token: opencodeZenToken.trim() || undefined,
        model: opencodeModel || undefined,
      },
      claude_code: {
        oauth_token: claudeOAuthToken.trim() || undefined,
        model: claudeModel,
      },
    });
  };

  if (isLoading) {
    return (
      <ScreenWrapper title="AI Agents" navigation={navigation}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper title="AI Agents" navigation={navigation}>
      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>OpenCode</Text>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          Zen token for OpenCode AI assistant
        </Text>
        <SettingRow
          label="Zen Token"
          value={opencodeZenToken}
          placeholder="zen_..."
          onChangeText={(t) => {
            setOpencodeZenToken(t);
            setHasChanges(true);
          }}
          secureTextEntry
        />
        {opencodeModels.length > 0 && (
          <ModelPicker
            label="Model"
            models={opencodeModels}
            selectedModel={opencodeModel}
            onSelect={(m) => {
              setOpencodeModel(m);
              setHasChanges(true);
            }}
          />
        )}
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Claude Code</Text>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          Run `claude setup-token` locally to generate
        </Text>
        <SettingRow
          label="OAuth Token"
          value={claudeOAuthToken}
          placeholder="sk-ant-oat01-..."
          onChangeText={(t) => {
            setClaudeOAuthToken(t);
            setHasChanges(true);
          }}
          secureTextEntry
        />
        <ModelPicker
          label="Model"
          models={claudeModels}
          selectedModel={claudeModel}
          onSelect={(m) => {
            setClaudeModel(m);
            setHasChanges(true);
          }}
        />
      </Card>

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.accent }, !hasChanges && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!hasChanges || mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScreenWrapper>
  );
}

export function EnvironmentSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: api.getCredentials,
  });

  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (credentials && !initialized) {
      const entries = Object.entries(credentials.env || {}).map(([key, value]) => ({ key, value }));
      setEnvVars(entries.length > 0 ? entries : [{ key: '', value: '' }]);
      setInitialized(true);
    }
  }, [credentials, initialized]);

  const mutation = useMutation({
    mutationFn: (data: Credentials) => api.updateCredentials(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      setHasChanges(false);
      Alert.alert('Success', 'Environment variables saved');
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err));
    },
  });

  const handleAddVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
    setHasChanges(true);
  };

  const handleRemoveVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleUpdateVar = (index: number, field: 'key' | 'value', text: string) => {
    const newVars = [...envVars];
    newVars[index][field] = text;
    setEnvVars(newVars);
    setHasChanges(true);
  };

  const handleSave = () => {
    const env: Record<string, string> = {};
    envVars.forEach(({ key, value }) => {
      if (key.trim()) {
        env[key.trim()] = value;
      }
    });
    mutation.mutate({
      env,
      files: credentials?.files || {},
    });
  };

  if (isLoading) {
    return (
      <ScreenWrapper title="Environment Variables" navigation={navigation}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper title="Environment Variables" navigation={navigation}>
      <Card>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          Environment variables injected into all workspaces
        </Text>
        {envVars.map((envVar, index) => (
          <View key={index} style={styles.envVarRow}>
            <TextInput
              style={[styles.input, styles.envKeyInput, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
              value={envVar.key}
              onChangeText={(t) => handleUpdateVar(index, 'key', t)}
              placeholder="NAME"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TextInput
              style={[styles.input, styles.envValueInput, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
              value={envVar.value}
              onChangeText={(t) => handleUpdateVar(index, 'value', t)}
              placeholder="value"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveVar(index)}>
              <Text style={styles.removeButtonText}>−</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={[styles.addButton, { borderColor: colors.border }]} onPress={handleAddVar}>
          <Text style={[styles.addButtonText, { color: colors.accent }]}>+ Add Variable</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.accent }, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </Card>
    </ScreenWrapper>
  );
}

export function FilesSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: api.getCredentials,
  });

  const [fileMappings, setFileMappings] = useState<Array<{ source: string; dest: string }>>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (credentials && !initialized) {
      const entries = Object.entries(credentials.files || {}).map(([dest, source]) => ({
        source: source as string,
        dest,
      }));
      setFileMappings(entries.length > 0 ? entries : [{ source: '', dest: '' }]);
      setInitialized(true);
    }
  }, [credentials, initialized]);

  const mutation = useMutation({
    mutationFn: (data: Credentials) => api.updateCredentials(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      setHasChanges(false);
      Alert.alert('Success', 'File mappings saved');
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err));
    },
  });

  const handleAddMapping = () => {
    setFileMappings([...fileMappings, { source: '', dest: '' }]);
    setHasChanges(true);
  };

  const handleRemoveMapping = (index: number) => {
    setFileMappings(fileMappings.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleUpdateMapping = (index: number, field: 'source' | 'dest', text: string) => {
    const newMappings = [...fileMappings];
    newMappings[index][field] = text;
    setFileMappings(newMappings);
    setHasChanges(true);
  };

  const handleSave = () => {
    const files: Record<string, string> = {};
    fileMappings.forEach(({ source, dest }) => {
      if (dest.trim() && source.trim()) {
        files[dest.trim()] = source.trim();
      }
    });
    mutation.mutate({
      env: credentials?.env || {},
      files,
    });
  };

  if (isLoading) {
    return (
      <ScreenWrapper title="File Mappings" navigation={navigation}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper title="File Mappings" navigation={navigation}>
      <Card>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          Copy files from host to workspace (e.g., SSH keys, configs)
        </Text>
        {fileMappings.map((mapping, index) => (
          <View key={index} style={styles.fileMappingRow}>
            <View style={styles.fileMappingInputs}>
              <TextInput
                style={[styles.input, styles.fileInput, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
                value={mapping.source}
                onChangeText={(t) => handleUpdateMapping(index, 'source', t)}
                placeholder="~/.ssh/id_rsa"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.arrowText, { color: colors.textMuted }]}>→</Text>
              <TextInput
                style={[styles.input, styles.fileInput, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
                value={mapping.dest}
                onChangeText={(t) => handleUpdateMapping(index, 'dest', t)}
                placeholder="~/.ssh/id_rsa"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveMapping(index)}
            >
              <Text style={styles.removeButtonText}>−</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={[styles.addButton, { borderColor: colors.border }]} onPress={handleAddMapping}>
          <Text style={[styles.addButtonText, { color: colors.accent }]}>+ Add Mapping</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.accent }, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </Card>
    </ScreenWrapper>
  );
}

export function ScriptsSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: scripts, isLoading } = useQuery({
    queryKey: ['scripts'],
    queryFn: api.getScripts,
  });

  const [postStartScript, setPostStartScript] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (scripts && !initialized) {
      setPostStartScript(scripts.post_start || '');
      setInitialized(true);
    }
  }, [scripts, initialized]);

  const mutation = useMutation({
    mutationFn: (data: Scripts) => api.updateScripts(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      setHasChanges(false);
      Alert.alert('Success', 'Scripts saved');
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err));
    },
  });

  const handleSave = () => {
    mutation.mutate({
      post_start: postStartScript.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <ScreenWrapper title="Scripts" navigation={navigation}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper title="Scripts" navigation={navigation}>
      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Post-Start Script</Text>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          Executed after each workspace starts as the workspace user
        </Text>
        <SettingRow
          label="Script Path"
          value={postStartScript}
          placeholder="~/scripts/post-start.sh"
          onChangeText={(t) => {
            setPostStartScript(t);
            setHasChanges(true);
          }}
        />
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.accent }, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </Card>
    </ScreenWrapper>
  );
}

export function SyncSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.syncAllWorkspaces(),
    onSuccess: (result) => {
      setLastResult(result);
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      if (result.failed === 0) {
        Alert.alert(
          'Success',
          `Synced credentials to ${result.synced} workspace${result.synced !== 1 ? 's' : ''}`
        );
      } else {
        Alert.alert(
          'Partial Success',
          `Synced: ${result.synced}, Failed: ${result.failed}\n\n${result.results
            .filter((r) => !r.success)
            .map((r) => `${r.name}: ${r.error}`)
            .join('\n')}`
        );
      }
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err));
    },
  });

  return (
    <ScreenWrapper title="Sync" navigation={navigation}>
      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Sync All Workspaces</Text>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          Push environment variables, file mappings, and agent credentials to all running workspaces
        </Text>
        {lastResult && (
          <View style={[styles.syncResultContainer, { backgroundColor: colors.surfaceSecondary }]}>
            <View style={styles.syncResultRow}>
              <Text style={[styles.syncResultLabel, { color: colors.textMuted }]}>Last sync:</Text>
              <Text
                style={[
                  styles.syncResultValue,
                  { color: lastResult.failed === 0 ? '#34c759' : '#ff9f0a' },
                ]}
              >
                {lastResult.synced} synced, {lastResult.failed} failed
              </Text>
            </View>
          </View>
        )}
        <TouchableOpacity
          style={styles.syncButton}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.syncButtonText}>Sync Now</Text>
          )}
        </TouchableOpacity>
      </Card>
    </ScreenWrapper>
  );
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function AboutSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { status, checkConnection } = useNetwork();
  const { data: info, isLoading } = useQuery({
    queryKey: ['info'],
    queryFn: api.getInfo,
    retry: false,
  });

  const isConnected = status === 'connected';

  return (
    <ScreenWrapper title="About" navigation={navigation}>
      <Card>
        {isLoading && status === 'connecting' ? (
          <ActivityIndicator size="large" color={colors.accent} />
        ) : isConnected && info ? (
          <>
            <View style={[styles.aboutRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>Host</Text>
              <Text style={[styles.aboutValue, { color: colors.text }]}>{info.hostname}</Text>
            </View>
            <View style={[styles.aboutRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>Docker</Text>
              <Text style={[styles.aboutValue, { color: colors.text }]}>{info.dockerVersion}</Text>
            </View>
            <View style={[styles.aboutRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>Workspaces</Text>
              <Text style={[styles.aboutValue, { color: colors.text }]}>{info.workspacesCount}</Text>
            </View>
            <View style={[styles.aboutRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>Uptime</Text>
              <Text style={[styles.aboutValue, { color: colors.text }]}>{formatUptime(info.uptime)}</Text>
            </View>
            <View style={[styles.aboutRow, styles.statusRow]}>
              <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>Status</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Connected</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={[styles.errorTitle, { color: colors.text }]}>
              {status === 'server-unreachable' ? 'Server Unreachable' : 'Connection Error'}
            </Text>
            <Text style={[styles.errorText, { color: colors.textMuted }]}>
              {status === 'server-unreachable'
                ? 'Cannot reach the workspace agent. Check your Tailscale VPN connection and server URL.'
                : 'Unable to connect to the server.'}
            </Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.accent }]} onPress={checkConnection}>
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </ScreenWrapper>
  );
}

export function GitHubSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  });

  const [githubToken, setGithubToken] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (agents && !initialized) {
      setGithubToken(agents.github?.token || '');
      setInitialized(true);
    }
  }, [agents, initialized]);

  const mutation = useMutation({
    mutationFn: (data: CodingAgents) => api.updateAgents(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setHasChanges(false);
      Alert.alert('Success', 'GitHub token saved');
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err));
    },
  });

  const handleSave = () => {
    mutation.mutate({
      ...agents,
      github: { token: githubToken.trim() || undefined },
    });
  };

  if (isLoading) {
    return (
      <ScreenWrapper title="GitHub" navigation={navigation}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper title="GitHub" navigation={navigation}>
      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Personal Access Token</Text>
        <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
          Used for git operations. Injected as GITHUB_TOKEN.
        </Text>
        <SettingRow
          label="Token"
          value={githubToken}
          placeholder="ghp_... or github_pat_..."
          onChangeText={(t) => {
            setGithubToken(t);
            setHasChanges(true);
          }}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.accent }, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </Card>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 32,
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 44,
  },
  content: {
    padding: 16,
  },
  indexContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  navGroup: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  navRowContent: {
    flex: 1,
  },
  navRowTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  navRowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  navRowChevron: {
    fontSize: 20,
    marginLeft: 8,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    marginBottom: 16,
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    fontFamily: 'monospace',
  },
  modelPicker: {
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelPickerText: {
    fontSize: 15,
  },
  modelPickerChevron: {
    fontSize: 18,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeList: {
    gap: 8,
  },
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  themePreviewDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  themeItemContent: {
    flex: 1,
  },
  themeItemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  themeItemDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  themeCheckmark: {
    fontSize: 18,
    fontWeight: '600',
  },
  envVarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  envKeyInput: {
    flex: 1,
    minWidth: 80,
  },
  envValueInput: {
    flex: 2,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  fileMappingRow: {
    marginBottom: 12,
  },
  fileMappingInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  fileInput: {
    flex: 1,
  },
  arrowText: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
  syncButton: {
    backgroundColor: '#34c759',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  syncButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  syncResultContainer: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  syncResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncResultLabel: {
    fontSize: 13,
  },
  syncResultValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  aboutLabel: {
    fontSize: 14,
  },
  aboutValue: {
    fontSize: 14,
  },
  statusRow: {
    borderBottomWidth: 0,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34c759',
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#34c759',
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
