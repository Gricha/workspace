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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, CodingAgents, getBaseUrl, setBaseUrl, refreshClient } from '../lib/api'

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
      Alert.alert('Error', (err as Error).message)
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

function ConnectionSettings() {
  const [serverUrl, setServerUrl] = useState(getBaseUrl())
  const [hasChanges, setHasChanges] = useState(false)
  const queryClient = useQueryClient()

  const handleSave = () => {
    setBaseUrl(serverUrl.trim())
    refreshClient()
    queryClient.invalidateQueries()
    setHasChanges(false)
    Alert.alert('Success', 'Server URL updated')
  }

  return (
    <Section title="Connection">
      <View style={styles.agentCard}>
        <Text style={styles.agentName}>Agent Server</Text>
        <Text style={styles.agentDescription}>URL of the workspace agent</Text>
        <SettingRow
          label="Server URL"
          value={serverUrl}
          placeholder="http://localhost:8420"
          onChangeText={(t) => { setServerUrl(t); setHasChanges(true) }}
        />
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges}
        >
          <Text style={styles.saveButtonText}>Update Server</Text>
        </TouchableOpacity>
      </View>
    </Section>
  )
}

function AboutSection() {
  const { data: info, isLoading } = useQuery({
    queryKey: ['info'],
    queryFn: api.getInfo,
    retry: false,
  })

  return (
    <Section title="About">
      <View style={styles.aboutCard}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#0a84ff" />
        ) : info ? (
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
          </>
        ) : (
          <Text style={styles.errorText}>Cannot connect to server</Text>
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

export function SettingsScreen() {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ConnectionSettings />
        <AgentsSettings />
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
  errorText: {
    fontSize: 14,
    color: '#ff3b30',
    textAlign: 'center',
  },
})
