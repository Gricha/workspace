import { useState, useEffect } from 'react'
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
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, CodingAgents, Credentials, Scripts, SyncResult, getBaseUrl, saveServerConfig, getDefaultPort, refreshClient } from '../lib/api'
import { useNetwork, parseNetworkError } from '../lib/network'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

function SettingRow({
  label,
  value,
  placeholder,
  onChangeText,
  secureTextEntry,
}: {
  label: string
  value: string
  placeholder: string
  onChangeText: (text: string) => void
  secureTextEntry?: boolean
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#666"
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  )
}

function AgentsSettings() {
  const queryClient = useQueryClient()

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  })

  const [openaiKey, setOpenaiKey] = useState('')
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [claudeOAuthToken, setClaudeOAuthToken] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
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
      setHasChanges(false)
      Alert.alert('Success', 'Settings saved')
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err))
    },
  })

  const handleSave = () => {
    mutation.mutate({
      opencode: {
        api_key: openaiKey.trim() || undefined,
        api_base_url: openaiBaseUrl.trim() || undefined,
      },
      github: {
        token: githubToken.trim() || undefined,
      },
      claude_code: {
        oauth_token: claudeOAuthToken.trim() || undefined,
      },
    })
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#0a84ff" />
      </View>
    )
  }

  return (
    <Section title="Coding Agents">
      <View style={styles.agentCard}>
        <Text style={styles.agentName}>OpenCode</Text>
        <Text style={styles.agentDescription}>OpenAI-compatible API for AI-assisted coding</Text>
        <SettingRow
          label="API Key"
          value={openaiKey}
          placeholder="sk-..."
          onChangeText={(t) => { setOpenaiKey(t); setHasChanges(true) }}
          secureTextEntry
        />
        <SettingRow
          label="Base URL"
          value={openaiBaseUrl}
          placeholder="https://api.openai.com/v1"
          onChangeText={(t) => { setOpenaiBaseUrl(t); setHasChanges(true) }}
        />
      </View>

      <View style={styles.agentCard}>
        <Text style={styles.agentName}>Claude Code</Text>
        <Text style={styles.agentDescription}>Run `claude setup-token` locally to generate</Text>
        <SettingRow
          label="OAuth Token"
          value={claudeOAuthToken}
          placeholder="sk-ant-oat01-..."
          onChangeText={(t) => { setClaudeOAuthToken(t); setHasChanges(true) }}
          secureTextEntry
        />
      </View>

      <View style={styles.agentCard}>
        <Text style={styles.agentName}>GitHub</Text>
        <Text style={styles.agentDescription}>Personal Access Token for git operations</Text>
        <SettingRow
          label="Token"
          value={githubToken}
          placeholder="ghp_..."
          onChangeText={(t) => { setGithubToken(t); setHasChanges(true) }}
          secureTextEntry
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!hasChanges || mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </Section>
  )
}

function EnvironmentSettings() {
  const queryClient = useQueryClient()

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: api.getCredentials,
  })

  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (credentials && !initialized) {
      const entries = Object.entries(credentials.env || {}).map(([key, value]) => ({ key, value }))
      setEnvVars(entries.length > 0 ? entries : [{ key: '', value: '' }])
      setInitialized(true)
    }
  }, [credentials, initialized])

  const mutation = useMutation({
    mutationFn: (data: Credentials) => api.updateCredentials(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] })
      setHasChanges(false)
      Alert.alert('Success', 'Environment variables saved')
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err))
    },
  })

  const handleAddVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
    setHasChanges(true)
  }

  const handleRemoveVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  const handleUpdateVar = (index: number, field: 'key' | 'value', text: string) => {
    const newVars = [...envVars]
    newVars[index][field] = text
    setEnvVars(newVars)
    setHasChanges(true)
  }

  const handleSave = () => {
    const env: Record<string, string> = {}
    envVars.forEach(({ key, value }) => {
      if (key.trim()) {
        env[key.trim()] = value
      }
    })
    mutation.mutate({
      env,
      files: credentials?.files || {},
    })
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#0a84ff" />
      </View>
    )
  }

  return (
    <Section title="Environment Variables">
      <View style={styles.agentCard}>
        <Text style={styles.agentDescription}>
          Environment variables injected into all workspaces
        </Text>
        {envVars.map((envVar, index) => (
          <View key={index} style={styles.envVarRow}>
            <TextInput
              style={[styles.input, styles.envKeyInput]}
              value={envVar.key}
              onChangeText={(t) => handleUpdateVar(index, 'key', t)}
              placeholder="NAME"
              placeholderTextColor="#666"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TextInput
              style={[styles.input, styles.envValueInput]}
              value={envVar.value}
              onChangeText={(t) => handleUpdateVar(index, 'value', t)}
              placeholder="value"
              placeholderTextColor="#666"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveVar(index)}
            >
              <Text style={styles.removeButtonText}>-</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={handleAddVar}>
          <Text style={styles.addButtonText}>+ Add Variable</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </Section>
  )
}

function FilesSettings() {
  const queryClient = useQueryClient()

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: api.getCredentials,
  })

  const [fileMappings, setFileMappings] = useState<Array<{ source: string; dest: string }>>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (credentials && !initialized) {
      const entries = Object.entries(credentials.files || {}).map(([dest, source]) => ({
        source: source as string,
        dest,
      }))
      setFileMappings(entries.length > 0 ? entries : [{ source: '', dest: '' }])
      setInitialized(true)
    }
  }, [credentials, initialized])

  const mutation = useMutation({
    mutationFn: (data: Credentials) => api.updateCredentials(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] })
      setHasChanges(false)
      Alert.alert('Success', 'File mappings saved')
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err))
    },
  })

  const handleAddMapping = () => {
    setFileMappings([...fileMappings, { source: '', dest: '' }])
    setHasChanges(true)
  }

  const handleRemoveMapping = (index: number) => {
    setFileMappings(fileMappings.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  const handleUpdateMapping = (index: number, field: 'source' | 'dest', text: string) => {
    const newMappings = [...fileMappings]
    newMappings[index][field] = text
    setFileMappings(newMappings)
    setHasChanges(true)
  }

  const handleSave = () => {
    const files: Record<string, string> = {}
    fileMappings.forEach(({ source, dest }) => {
      if (dest.trim() && source.trim()) {
        files[dest.trim()] = source.trim()
      }
    })
    mutation.mutate({
      env: credentials?.env || {},
      files,
    })
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#0a84ff" />
      </View>
    )
  }

  return (
    <Section title="File Mappings">
      <View style={styles.agentCard}>
        <Text style={styles.agentDescription}>
          Copy files from host to workspace (e.g., SSH keys, configs)
        </Text>
        {fileMappings.map((mapping, index) => (
          <View key={index} style={styles.fileMappingRow}>
            <View style={styles.fileMappingInputs}>
              <TextInput
                style={[styles.input, styles.fileInput]}
                value={mapping.source}
                onChangeText={(t) => handleUpdateMapping(index, 'source', t)}
                placeholder="~/.ssh/id_rsa"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.arrowText}>{'->'}</Text>
              <TextInput
                style={[styles.input, styles.fileInput]}
                value={mapping.dest}
                onChangeText={(t) => handleUpdateMapping(index, 'dest', t)}
                placeholder="~/.ssh/id_rsa"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveMapping(index)}
            >
              <Text style={styles.removeButtonText}>-</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={handleAddMapping}>
          <Text style={styles.addButtonText}>+ Add Mapping</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </Section>
  )
}

function ScriptsSettings() {
  const queryClient = useQueryClient()

  const { data: scripts, isLoading } = useQuery({
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
      Alert.alert('Success', 'Scripts saved')
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err))
    },
  })

  const handleSave = () => {
    mutation.mutate({
      post_start: postStartScript.trim() || undefined,
    })
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#0a84ff" />
      </View>
    )
  }

  return (
    <Section title="Scripts">
      <View style={styles.agentCard}>
        <Text style={styles.agentName}>Post-Start Script</Text>
        <Text style={styles.agentDescription}>
          Executed after each workspace starts as the workspace user
        </Text>
        <SettingRow
          label="Script Path"
          value={postStartScript}
          placeholder="~/scripts/post-start.sh"
          onChangeText={(t) => { setPostStartScript(t); setHasChanges(true) }}
        />
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </Section>
  )
}

function SyncSettings() {
  const queryClient = useQueryClient()
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.syncAllWorkspaces(),
    onSuccess: (result) => {
      setLastResult(result)
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      if (result.failed === 0) {
        Alert.alert('Success', `Synced credentials to ${result.synced} workspace${result.synced !== 1 ? 's' : ''}`)
      } else {
        Alert.alert(
          'Partial Success',
          `Synced: ${result.synced}, Failed: ${result.failed}\n\n${result.results
            .filter(r => !r.success)
            .map(r => `${r.name}: ${r.error}`)
            .join('\n')}`
        )
      }
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err))
    },
  })

  return (
    <Section title="Sync">
      <View style={styles.agentCard}>
        <Text style={styles.agentName}>Sync All Workspaces</Text>
        <Text style={styles.agentDescription}>
          Push environment variables, file mappings, and agent credentials to all running workspaces
        </Text>
        {lastResult && (
          <View style={styles.syncResultContainer}>
            <View style={styles.syncResultRow}>
              <Text style={styles.syncResultLabel}>Last sync:</Text>
              <Text style={[styles.syncResultValue, { color: lastResult.failed === 0 ? '#34c759' : '#ff9f0a' }]}>
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
      </View>
    </Section>
  )
}

function ConnectionSettings() {
  const currentUrl = getBaseUrl()
  const urlMatch = currentUrl.match(/^https?:\/\/([^:]+):(\d+)$/)
  const [host, setHost] = useState(urlMatch?.[1] || '')
  const [port, setPort] = useState(urlMatch?.[2] || String(getDefaultPort()))
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const queryClient = useQueryClient()

  const handleSave = async () => {
    const trimmedHost = host.trim()
    if (!trimmedHost) {
      Alert.alert('Error', 'Please enter a hostname')
      return
    }
    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Alert.alert('Error', 'Please enter a valid port number')
      return
    }

    setIsSaving(true)
    try {
      await saveServerConfig(trimmedHost, portNum)
      refreshClient()
      queryClient.invalidateQueries()
      setHasChanges(false)
      Alert.alert('Success', 'Server settings updated')
    } catch (err) {
      Alert.alert('Error', 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Section title="Connection">
      <View style={styles.agentCard}>
        <Text style={styles.agentName}>Agent Server</Text>
        <Text style={styles.agentDescription}>Hostname and port of the workspace agent</Text>
        <SettingRow
          label="Hostname"
          value={host}
          placeholder="my-server.tailnet.ts.net"
          onChangeText={(t) => { setHost(t); setHasChanges(true) }}
        />
        <SettingRow
          label="Port"
          value={port}
          placeholder={String(getDefaultPort())}
          onChangeText={(t) => { setPort(t); setHasChanges(true) }}
        />
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Update Server</Text>
          )}
        </TouchableOpacity>
      </View>
    </Section>
  )
}

function AboutSection() {
  const { status, serverHostname, checkConnection } = useNetwork()
  const { data: info, isLoading } = useQuery({
    queryKey: ['info'],
    queryFn: api.getInfo,
    retry: false,
  })

  const isConnected = status === 'connected'

  return (
    <Section title="About">
      <View style={styles.aboutCard}>
        {isLoading && status === 'connecting' ? (
          <ActivityIndicator size="small" color="#0a84ff" />
        ) : isConnected && info ? (
          <>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Host</Text>
              <Text style={styles.aboutValue}>{info.hostname}</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Docker</Text>
              <Text style={styles.aboutValue}>{info.dockerVersion}</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Workspaces</Text>
              <Text style={styles.aboutValue}>{info.workspacesCount}</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Uptime</Text>
              <Text style={styles.aboutValue}>{formatUptime(info.uptime)}</Text>
            </View>
            <View style={[styles.aboutRow, styles.statusRow]}>
              <Text style={styles.aboutLabel}>Status</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Connected</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorTitle}>
              {status === 'server-unreachable' ? 'Server Unreachable' : 'Connection Error'}
            </Text>
            <Text style={styles.errorText}>
              {status === 'server-unreachable'
                ? 'Cannot reach the workspace agent. Check your Tailscale VPN connection and server URL.'
                : 'Unable to connect to the server.'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={checkConnection}>
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Section>
  )
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

export function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets()

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <ConnectionSettings />
        <SyncSettings />
        <AgentsSettings />
        <EnvironmentSettings />
        <FilesSettings />
        <ScriptsSettings />
        <AboutSection />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 32,
    color: '#0a84ff',
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 44,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  agentCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  agentName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  agentDescription: {
    fontSize: 13,
    color: '#8e8e93',
    marginBottom: 16,
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#8e8e93',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#fff',
    fontFamily: 'monospace',
  },
  saveButton: {
    backgroundColor: '#0a84ff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#2c2c2e',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  aboutCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  aboutLabel: {
    fontSize: 14,
    color: '#8e8e93',
  },
  aboutValue: {
    fontSize: 14,
    color: '#fff',
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
    color: '#fff',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#0a84ff',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    borderRadius: 8,
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  addButtonText: {
    fontSize: 14,
    color: '#0a84ff',
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
    color: '#8e8e93',
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
    backgroundColor: '#2c2c2e',
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
    color: '#8e8e93',
  },
  syncResultValue: {
    fontSize: 13,
    fontWeight: '600',
  },
})
