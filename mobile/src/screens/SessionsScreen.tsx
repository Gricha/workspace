import { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api, WorkspaceInfo, SessionInfo, SessionMessage, AgentType } from '../lib/api'

function AgentBadge({ type }: { type: AgentType }) {
  const labels: Record<AgentType, string> = {
    'claude-code': 'Claude',
    opencode: 'OpenCode',
    codex: 'Codex',
  }
  const colors: Record<AgentType, string> = {
    'claude-code': '#ff6b35',
    opencode: '#34c759',
    codex: '#007aff',
  }
  return (
    <View style={[styles.agentBadge, { backgroundColor: colors[type] }]}>
      <Text style={styles.agentBadgeText}>{labels[type]}</Text>
    </View>
  )
}

function SessionItem({
  session,
  onPress,
}: {
  session: SessionInfo
  onPress: () => void
}) {
  const preview = session.firstPrompt?.slice(0, 80) || 'No messages'
  const date = new Date(session.lastActivity)
  const timeAgo = getTimeAgo(date)

  return (
    <TouchableOpacity style={styles.item} onPress={onPress}>
      <View style={styles.itemHeader}>
        <AgentBadge type={session.agentType} />
        <Text style={styles.itemTime}>{timeAgo}</Text>
      </View>
      <Text style={styles.itemPreview} numberOfLines={2}>
        {preview}
      </Text>
      <Text style={styles.itemMeta}>
        {session.messageCount} messages
      </Text>
    </TouchableOpacity>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function MessageBubble({ message }: { message: SessionMessage }) {
  const isUser = message.type === 'user'
  const isSystem = message.type === 'system'
  const isTool = message.type === 'tool_use' || message.type === 'tool_result'

  if (isTool) {
    return (
      <View style={styles.toolMessage}>
        <Text style={styles.toolLabel}>
          {message.type === 'tool_use' ? `Using: ${message.toolName}` : 'Tool Result'}
        </Text>
        <Text style={styles.toolContent} numberOfLines={10}>
          {message.content || message.toolInput || ''}
        </Text>
      </View>
    )
  }

  if (isSystem) {
    return (
      <View style={styles.systemMessage}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
      <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>{message.content}</Text>
    </View>
  )
}

function SessionDetailModal({
  workspaceName,
  session,
  onClose,
}: {
  workspaceName: string
  session: SessionInfo
  onClose: () => void
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['session', workspaceName, session.id],
    queryFn: () => api.getSession(workspaceName, session.id),
  })

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.detailClose}>Close</Text>
          </TouchableOpacity>
          <View style={styles.detailTitleContainer}>
            <AgentBadge type={session.agentType} />
          </View>
          <View style={{ width: 50 }} />
        </View>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0a84ff" />
          </View>
        ) : (
          <FlatList
            data={detail?.messages || []}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={styles.messageList}
            inverted={false}
          />
        )}
      </View>
    </Modal>
  )
}

function WorkspaceSessionsList({ workspace }: { workspace: WorkspaceInfo }) {
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null)

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sessions', workspace.name],
    queryFn: () => api.listSessions(workspace.name, undefined, 50),
  })

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#0a84ff" />
      </View>
    )
  }

  const sessions = data?.sessions || []

  if (sessions.length === 0) {
    return (
      <View style={styles.emptyWorkspace}>
        <Text style={styles.emptyWorkspaceText}>No sessions</Text>
      </View>
    )
  }

  return (
    <View>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SessionItem session={item} onPress={() => setSelectedSession(item)} />
        )}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0a84ff" />}
        scrollEnabled={false}
      />
      {selectedSession && (
        <SessionDetailModal
          workspaceName={workspace.name}
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </View>
  )
}

export function SessionsScreen() {
  const { data: workspaces, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.listWorkspaces,
  })

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a84ff" />
      </View>
    )
  }

  const runningWorkspaces = (workspaces || []).filter((w) => w.status === 'running')

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0a84ff" />}
    >
      {runningWorkspaces.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No running workspaces</Text>
          <Text style={styles.emptySubtext}>Start a workspace to see sessions</Text>
        </View>
      ) : (
        runningWorkspaces.map((workspace) => (
          <View key={workspace.name} style={styles.workspaceSection}>
            <Text style={styles.workspaceName}>{workspace.name}</Text>
            <WorkspaceSessionsList workspace={workspace} />
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#8e8e93',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#636366',
    marginTop: 4,
  },
  workspaceSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  workspaceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyWorkspace: {
    padding: 16,
    alignItems: 'center',
  },
  emptyWorkspaceText: {
    fontSize: 14,
    color: '#636366',
  },
  item: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemTime: {
    fontSize: 12,
    color: '#636366',
  },
  itemPreview: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    marginBottom: 6,
  },
  itemMeta: {
    fontSize: 12,
    color: '#636366',
  },
  agentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  agentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  detailClose: {
    fontSize: 16,
    color: '#0a84ff',
  },
  detailTitleContainer: {
    alignItems: 'center',
  },
  messageList: {
    padding: 16,
  },
  bubble: {
    maxWidth: '80%',
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
    backgroundColor: '#2c2c2e',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
  },
  userBubbleText: {
    color: '#fff',
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemText: {
    fontSize: 12,
    color: '#636366',
    fontStyle: 'italic',
  },
  toolMessage: {
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ff9f0a',
  },
  toolLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ff9f0a',
    marginBottom: 4,
  },
  toolContent: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#8e8e93',
  },
})
