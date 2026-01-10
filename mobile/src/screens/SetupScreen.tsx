import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { saveServerConfig, getDefaultPort, refreshClient, api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

const SETUP_GUIDE_URL = 'https://gricha.github.io/perry/docs/introduction'

interface SetupScreenProps {
  onComplete: () => void
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const [host, setHost] = useState('')
  const [port, setPort] = useState(String(getDefaultPort()))
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    const trimmedHost = host.trim()
    if (!trimmedHost) {
      setError('Please enter a hostname')
      return
    }

    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError('Please enter a valid port number')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      await saveServerConfig(trimmedHost, portNum)
      refreshClient()
      await api.getInfo()
      onComplete()
    } catch (err) {
      const message = (err as Error).message || 'Connection failed'
      if (message.includes('Network request failed')) {
        setError(`Cannot connect to ${trimmedHost}:${portNum}. Check the hostname and ensure the server is running.`)
      } else {
        setError(message)
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSetupGuide = () => {
    Linking.openURL(SETUP_GUIDE_URL)
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logoImage}
            />
            <Text style={[styles.logo, { color: colors.text }]}>Perry</Text>
            <Text style={[styles.tagline, { color: colors.textMuted }]} testID="tagline">Isolated, self-hosted workspaces{'\n'}accessible over Tailscale</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.surfaceSecondary }]} />

          <TouchableOpacity style={[styles.setupGuideCard, { backgroundColor: colors.surface }]} onPress={handleSetupGuide}>
            <View style={styles.setupGuideContent}>
              <Text style={[styles.setupGuideTitle, { color: colors.accent }]}>Setup Guide</Text>
              <Text style={[styles.setupGuideSubtitle, { color: colors.textMuted }]}>New to Perry? Learn how to set up your server</Text>
            </View>
            <Text style={[styles.setupGuideArrow, { color: colors.accent }]}>→</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.surfaceSecondary }]} />

          <View style={styles.form}>
            <Text style={[styles.formHeader, { color: colors.textMuted }]}>Already have a server?</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Server Hostname</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                value={host}
                onChangeText={setHost}
                placeholder="my-server.tailnet.ts.net"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                testID="hostname-input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Port</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                value={port}
                onChangeText={setPort}
                placeholder="7391"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                testID="port-input"
              />
            </View>

            {error && (
              <View style={[styles.errorContainer, { backgroundColor: `${colors.error}26` }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.accent }, isConnecting && styles.buttonDisabled]}
              onPress={handleConnect}
              disabled={isConnecting}
              testID="connect-button"
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color={colors.accentText} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.accentText }]}>Connect</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 16,
  },
  logo: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#2c2c2e',
    marginVertical: 24,
  },
  setupGuideCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  setupGuideContent: {
    flex: 1,
  },
  setupGuideTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0a84ff',
    marginBottom: 4,
  },
  setupGuideSubtitle: {
    fontSize: 14,
    color: '#8e8e93',
  },
  setupGuideArrow: {
    fontSize: 20,
    color: '#0a84ff',
    marginLeft: 12,
  },
  form: {
    gap: 16,
  },
  formHeader: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8e8e93',
    marginBottom: 4,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  input: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    color: '#fff',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ff3b30',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#0a84ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
})
