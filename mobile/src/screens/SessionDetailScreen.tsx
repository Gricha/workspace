import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, SessionMessage } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'
import { ThemeColors } from '../lib/themes'
import { AgentIcon } from '../components/AgentIcon'

function SessionMessageBubble({ message, colors }: { message: SessionMessage; colors: ThemeColors }) {
  const isUser = message.type === 'user'
  const isSystem = message.type === 'system'
  const isTool = message.type === 'tool_use' || message.type === 'tool_result'

  if (isTool) {
    return (
      <View style={[styles.toolMessage, { backgroundColor: colors.background, borderLeftColor: colors.warning }]}>
        <Text style={[styles.toolLabel, { color: colors.warning }]}>
          {message.type === 'tool_use' ? `Tool: ${message.toolName}` : 'Result'}
        </Text>
        <Text style={[styles.toolContent, { color: colors.textMuted }]} numberOfLines={15}>
          {message.content || message.toolInput || ''}
        </Text>
      </View>
    )
  }

  if (isSystem) {
    return (
      <View style={styles.systemMessage}>
        <Text style={[styles.systemText, { color: colors.textMuted }]}>{message.content}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.bubble, isUser ? [styles.userBubble, { backgroundColor: colors.accent }] : [styles.assistantBubble, { backgroundColor: colors.surface }]]}>
      <Text style={[styles.bubbleText, { color: isUser ? colors.accentText : colors.text }]}>{message.content}</Text>
    </View>
  )
}

export function SessionDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { workspaceName, sessionId, agentType } = route.params

  const { data: session, isLoading, error } = useQuery({
    queryKey: ['session', workspaceName, sessionId],
    queryFn: () => api.getSession(workspaceName, sessionId, agentType),
  })

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  if (error || !session) {
    return (
      <View style={[styles.container, styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Session Not Found</Text>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.accent }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.backButtonText, { color: colors.accentText }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={[styles.headerBackText, { color: colors.accent }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <AgentIcon agentType={agentType} size="md" />
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>{workspaceName}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.metaBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>{session.messages.length} messages</Text>
        <Text style={[styles.metaId, { color: colors.textMuted }]}>ID: {sessionId.slice(0, 8)}</Text>
      </View>

      <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
        {session.messages.map((msg, idx) => (
          <SessionMessageBubble key={idx} message={msg} colors={colors} />
        ))}
      </ScrollView>
    </View>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
    backgroundColor: '#000',
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackText: {
    fontSize: 24,
    color: '#0a84ff',
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8e8e93',
  },
  metaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0c0c0c',
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  metaText: {
    fontSize: 12,
    color: '#8e8e93',
  },
  metaId: {
    fontSize: 12,
    color: '#636366',
    fontFamily: 'monospace',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#0a84ff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    backgroundColor: '#0a84ff',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#1c1c1e',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 22,
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemText: {
    fontSize: 12,
    color: '#636366',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  toolMessage: {
    backgroundColor: '#0c0c0c',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ff9f0a',
    maxWidth: '90%',
    alignSelf: 'flex-start',
  },
  toolLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ff9f0a',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toolContent: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#8e8e93',
    lineHeight: 18,
  },
})
