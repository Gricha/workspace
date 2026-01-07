import { useState, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, SessionInfo, AgentType, HOST_WORKSPACE_NAME } from '../lib/api'

type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Older'

function getDateGroup(dateString: string): DateGroup {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  if (date >= today) return 'Today'
  if (date >= yesterday) return 'Yesterday'
  if (date >= weekAgo) return 'This Week'
  return 'Older'
}

function groupSessionsByDate(sessions: SessionInfo[]): Record<DateGroup, SessionInfo[]> {
  const groups: Record<DateGroup, SessionInfo[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  }
  sessions.forEach((s) => {
    const group = getDateGroup(s.lastActivity)
    groups[group].push(s)
  })
  return groups
}

function AgentBadge({ type }: { type: AgentType }) {
  const labels: Record<AgentType, string> = {
    'claude-code': 'CC',
    opencode: 'OC',
    codex: 'CX',
  }
  const colors: Record<AgentType, string> = {
    'claude-code': '#8b5cf6',
    opencode: '#22c55e',
    codex: '#f59e0b',
  }
  return (
    <View style={[styles.agentBadge, { backgroundColor: colors[type] }]}>
      <Text style={styles.agentBadgeText}>{labels[type]}</Text>
    </View>
  )
}

function SessionRow({
  session,
  onPress,
}: {
  session: SessionInfo
  onPress: () => void
}) {
  const timeAgo = useMemo(() => {
    const date = new Date(session.lastActivity)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }, [session.lastActivity])

  return (
    <TouchableOpacity style={styles.sessionRow} onPress={onPress}>
      <AgentBadge type={session.agentType} />
      <View style={styles.sessionContent}>
        <Text style={styles.sessionName} numberOfLines={1}>
          {session.name || session.firstPrompt || 'Empty session'}
        </Text>
        <Text style={styles.sessionMeta}>
          {session.messageCount} messages • {session.projectPath.split('/').pop()}
        </Text>
      </View>
      <Text style={styles.sessionTime}>{timeAgo}</Text>
      <Text style={styles.sessionChevron}>›</Text>
    </TouchableOpacity>
  )
}

function DateGroupHeader({ title }: { title: string }) {
  return (
    <View style={styles.dateGroupHeader}>
      <Text style={styles.dateGroupTitle}>{title}</Text>
    </View>
  )
}

export function WorkspaceDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets()
  const { name } = route.params
  const [agentFilter, setAgentFilter] = useState<AgentType | undefined>(undefined)
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const [showNewChatPicker, setShowNewChatPicker] = useState(false)
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false)

  const isHost = name === HOST_WORKSPACE_NAME

  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ['workspace', name],
    queryFn: () => api.getWorkspace(name),
    refetchInterval: 5000,
    enabled: !isHost,
  })

  const { data: hostInfo } = useQuery({
    queryKey: ['hostInfo'],
    queryFn: api.getHostInfo,
    enabled: isHost,
  })

  const { data: allWorkspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.listWorkspaces,
  })

  const isRunning = isHost ? true : workspace?.status === 'running'
  const isCreating = isHost ? false : workspace?.status === 'creating'

  const { data: sessionsData, isLoading: sessionsLoading, refetch } = useQuery({
    queryKey: ['sessions', name, agentFilter],
    queryFn: () => api.listSessions(name, agentFilter, 50),
    enabled: isRunning,
  })

  const groupedSessions = useMemo(() => {
    if (!sessionsData?.sessions) return null
    return groupSessionsByDate(sessionsData.sessions)
  }, [sessionsData?.sessions])

  const flatData = useMemo(() => {
    if (!groupedSessions) return []
    const result: ({ type: 'header'; title: DateGroup } | { type: 'session'; session: SessionInfo })[] = []
    const order: DateGroup[] = ['Today', 'Yesterday', 'This Week', 'Older']
    order.forEach((group) => {
      if (groupedSessions[group].length > 0) {
        result.push({ type: 'header', title: group })
        groupedSessions[group].forEach((s) => result.push({ type: 'session', session: s }))
      }
    })
    return result
  }, [groupedSessions])

  const displayName = isHost
    ? (hostInfo ? `${hostInfo.username}@${hostInfo.hostname}` : 'Host Machine')
    : name

  const agentLabels: Record<string, string> = {
    all: 'All Agents',
    'claude-code': 'Claude Code',
    opencode: 'OpenCode',
    codex: 'Codex',
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => setShowWorkspacePicker(!showWorkspacePicker)}
        >
          <Text style={[styles.headerTitle, isHost && styles.hostHeaderTitle]} numberOfLines={1}>{displayName}</Text>
          <View style={[styles.statusIndicator, { backgroundColor: isHost ? '#f59e0b' : (isRunning ? '#34c759' : isCreating ? '#ff9f0a' : '#636366') }]} />
          <Text style={styles.headerChevron}>▼</Text>
        </TouchableOpacity>
        {isHost ? (
          <View style={styles.settingsBtn} />
        ) : (
          <TouchableOpacity
            onPress={() => navigation.navigate('WorkspaceSettings', { name })}
            style={styles.settingsBtn}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setShowAgentPicker(!showAgentPicker)}
        >
          <Text style={styles.filterBtnText}>
            {agentLabels[agentFilter || 'all']}
          </Text>
          <Text style={styles.filterBtnArrow}>▼</Text>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.terminalBtn}
            onPress={() => navigation.navigate('Terminal', { name })}
            disabled={!isRunning}
            testID="terminal-button"
          >
            <Text style={[styles.terminalBtnText, !isRunning && styles.disabledText]}>Terminal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newChatBtn}
            onPress={() => setShowNewChatPicker(!showNewChatPicker)}
            disabled={!isRunning}
            testID="new-chat-button"
          >
            <Text style={[styles.newChatBtnText, !isRunning && styles.disabledText]}>New Chat ▼</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showAgentPicker && (
        <View style={styles.agentPicker}>
          {(['all', 'claude-code', 'opencode', 'codex'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.agentPickerItem,
                (type === 'all' ? !agentFilter : agentFilter === type) && styles.agentPickerItemActive,
              ]}
              onPress={() => {
                setAgentFilter(type === 'all' ? undefined : type as AgentType)
                setShowAgentPicker(false)
              }}
            >
              <Text style={styles.agentPickerText}>{agentLabels[type]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showNewChatPicker && (
        <View style={styles.newChatPickerOverlay}>
          <TouchableOpacity style={styles.newChatPickerBackdrop} onPress={() => setShowNewChatPicker(false)} />
          <View style={styles.newChatPicker}>
            <Text style={styles.newChatPickerTitle}>Start chat with</Text>
            {(['claude-code', 'opencode', 'codex'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.newChatPickerItem}
                onPress={() => {
                  setShowNewChatPicker(false)
                  navigation.navigate('SessionChat', { workspaceName: name, isNew: true, agentType: type })
                }}
              >
                <View style={[styles.agentBadgeLarge, { backgroundColor: type === 'claude-code' ? '#8b5cf6' : type === 'opencode' ? '#22c55e' : '#f59e0b' }]}>
                  <Text style={styles.agentBadgeLargeText}>{type === 'claude-code' ? 'CC' : type === 'opencode' ? 'OC' : 'CX'}</Text>
                </View>
                <Text style={styles.newChatPickerItemText}>{agentLabels[type]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {showWorkspacePicker && (
        <View style={styles.workspacePickerOverlay}>
          <TouchableOpacity style={styles.workspacePickerBackdrop} onPress={() => setShowWorkspacePicker(false)} />
          <View style={styles.workspacePicker}>
            <Text style={styles.workspacePickerTitle}>Switch workspace</Text>
            {allWorkspaces?.map((ws) => (
              <TouchableOpacity
                key={ws.name}
                style={[styles.workspacePickerItem, ws.name === name && styles.workspacePickerItemActive]}
                onPress={() => {
                  setShowWorkspacePicker(false)
                  if (ws.name !== name) {
                    navigation.replace('WorkspaceDetail', { name: ws.name })
                  }
                }}
              >
                <View style={[styles.workspaceStatusDot, { backgroundColor: ws.status === 'running' ? '#34c759' : ws.status === 'creating' ? '#ff9f0a' : '#636366' }]} />
                <Text style={[styles.workspacePickerItemText, ws.name === name && styles.workspacePickerItemTextActive]}>{ws.name}</Text>
                {ws.name === name && <Text style={styles.workspaceCheckmark}>✓</Text>}
              </TouchableOpacity>
            ))}
            {!isHost && (
              <TouchableOpacity
                style={styles.workspacePickerItem}
                onPress={() => {
                  setShowWorkspacePicker(false)
                  navigation.replace('WorkspaceDetail', { name: HOST_WORKSPACE_NAME })
                }}
              >
                <View style={[styles.workspaceStatusDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.workspacePickerItemText}>Host Machine</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {isHost && (
        <View style={styles.hostWarningBanner}>
          <Text style={styles.hostWarningText}>
            Commands run directly on your machine without isolation
          </Text>
        </View>
      )}

      {workspaceLoading && !isHost ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0a84ff" />
        </View>
      ) : !isRunning && !isHost ? (
        isCreating ? (
          <View style={styles.notRunning}>
            <ActivityIndicator size="large" color="#ff9f0a" style={{ marginBottom: 16 }} />
            <Text style={styles.notRunningText}>Workspace is starting</Text>
            <Text style={styles.notRunningSubtext}>Please wait while the container starts up</Text>
          </View>
        ) : (
          <View style={styles.notRunning}>
            <Text style={styles.notRunningText}>Workspace is not running</Text>
            <Text style={styles.notRunningSubtext}>Start it from settings to view sessions</Text>
          </View>
        )
      ) : sessionsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0a84ff" />
        </View>
      ) : flatData.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No sessions yet</Text>
          <Text style={styles.emptySubtext}>Start a new chat to create one</Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, idx) => item.type === 'header' ? `header-${item.title}` : `session-${item.session.id}`}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <DateGroupHeader title={item.title} />
            }
            return (
              <SessionRow
                session={item.session}
                onPress={() => navigation.navigate('SessionChat', {
                  workspaceName: name,
                  sessionId: item.session.id,
                  agentType: item.session.agentType,
                })}
              />
            )
          }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  hostHeaderTitle: {
    color: '#f59e0b',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 22,
    color: '#8e8e93',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  filterBtnText: {
    fontSize: 14,
    color: '#fff',
  },
  filterBtnArrow: {
    fontSize: 10,
    color: '#8e8e93',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  terminalBtn: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  terminalBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  newChatBtn: {
    backgroundColor: '#0a84ff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newChatBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  disabledText: {
    opacity: 0.4,
  },
  agentPicker: {
    backgroundColor: '#1c1c1e',
    marginHorizontal: 12,
    marginTop: -1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  agentPickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  agentPickerItemActive: {
    backgroundColor: '#2c2c2e',
  },
  agentPickerText: {
    fontSize: 15,
    color: '#fff',
  },
  hostWarningBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.2)',
  },
  hostWarningText: {
    fontSize: 12,
    color: '#f59e0b',
    textAlign: 'center',
  },
  notRunning: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  notRunningText: {
    fontSize: 17,
    color: '#8e8e93',
    fontWeight: '500',
  },
  notRunningSubtext: {
    fontSize: 14,
    color: '#636366',
    marginTop: 6,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 17,
    color: '#8e8e93',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#636366',
    marginTop: 4,
  },
  dateGroupHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dateGroupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  agentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 10,
  },
  agentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  sessionContent: {
    flex: 1,
  },
  sessionName: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  sessionMeta: {
    fontSize: 12,
    color: '#636366',
    marginTop: 2,
  },
  sessionTime: {
    fontSize: 13,
    color: '#636366',
    marginRight: 8,
  },
  sessionChevron: {
    fontSize: 18,
    color: '#636366',
  },
  newChatPickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  newChatPickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  newChatPicker: {
    position: 'absolute',
    top: 120,
    right: 12,
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 12,
    minWidth: 180,
  },
  newChatPickerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 12,
    textAlign: 'center',
  },
  newChatPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 12,
  },
  newChatPickerItemText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  agentBadgeLarge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentBadgeLargeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  headerChevron: {
    fontSize: 10,
    color: '#8e8e93',
    marginLeft: 4,
  },
  workspacePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  workspacePickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  workspacePicker: {
    position: 'absolute',
    top: 60,
    left: 50,
    right: 50,
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 12,
  },
  workspacePickerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 12,
    textAlign: 'center',
  },
  workspacePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 10,
  },
  workspacePickerItemActive: {
    backgroundColor: '#3c3c3e',
  },
  workspacePickerItemText: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  workspacePickerItemTextActive: {
    fontWeight: '600',
  },
  workspaceStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  workspaceCheckmark: {
    fontSize: 14,
    color: '#0a84ff',
    fontWeight: '600',
  },
})
