import { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, WorkspaceInfo, HOST_WORKSPACE_NAME, CreateWorkspaceRequest } from '../lib/api'
import { getUserWorkspaceNameError } from '../lib/workspace-name'
import { useNetwork, parseNetworkError } from '../lib/network'
import { useTheme } from '../contexts/ThemeContext'
import { RepoSelector } from '../components/RepoSelector'

const DELETE_ACTION_WIDTH = 80

function DeleteAction({
  drag,
  onPress,
  color,
}: {
  drag: SharedValue<number>
  onPress: () => void
  color: string
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value + DELETE_ACTION_WIDTH }],
  }))

  return (
    <Reanimated.View style={[styles.deleteAction, { backgroundColor: color }, animatedStyle]}>
      <TouchableOpacity style={styles.deleteActionTouchable} onPress={onPress}>
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    </Reanimated.View>
  )
}

function StatusDot({ status }: { status: WorkspaceInfo['status'] | 'host' }) {
  const colors = {
    running: '#34c759',
    stopped: '#636366',
    creating: '#ff9f0a',
    error: '#ff3b30',
    host: '#f59e0b',
  }
  return <View style={[styles.statusDot, { backgroundColor: colors[status] }]} />
}

function WorkspaceRow({
  workspace,
  onPress,
}: {
  workspace: WorkspaceInfo
  onPress: () => void
}) {
  const { colors } = useTheme()
  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: colors.background }]} onPress={onPress} testID={`workspace-item-${workspace.name}`}>
      <StatusDot status={workspace.status} />
      <View style={styles.rowContent}>
        <Text style={[styles.rowName, { color: colors.text }]} testID="workspace-name">{workspace.name}</Text>
        {workspace.repo && (
          <Text style={[styles.rowRepo, { color: colors.textMuted }]} numberOfLines={1}>{workspace.repo}</Text>
        )}
        {workspace.tailscale?.status === 'connected' && workspace.tailscale.hostname && (
          <Text style={[styles.rowTailscale, { color: colors.accent }]} numberOfLines={1}>
            {workspace.tailscale.hostname}
          </Text>
        )}
        {workspace.tailscale?.status === 'failed' && (
          <Text style={[styles.rowTailscale, { color: colors.warning }]} numberOfLines={1}>
            Tailscale failed
          </Text>
        )}
      </View>
      <Text style={[styles.rowChevron, { color: colors.textMuted }]}>›</Text>
    </TouchableOpacity>
  )
}

function HostSection({ onHostPress }: { onHostPress: () => void }) {
  const { colors } = useTheme()
  const { data: hostInfo, isLoading } = useQuery({
    queryKey: ['hostInfo'],
    queryFn: api.getHostInfo,
  })

  const { data: info } = useQuery({
    queryKey: ['info'],
    queryFn: api.getInfo,
  })

  if (isLoading) {
    return (
      <View style={[styles.hostSection, { borderBottomColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.textMuted} />
      </View>
    )
  }

  return (
    <View style={[styles.hostSection, { borderBottomColor: colors.border }]}>
      <View style={styles.hostHeader}>
        <Text style={[styles.hostLabel, { color: colors.textMuted }]}>Host Machine</Text>
        <Text style={[styles.hostName, { color: colors.text }]}>{info?.hostname || hostInfo?.hostname || 'Unknown'}</Text>
      </View>

      {hostInfo?.enabled ? (
        <>
          <TouchableOpacity style={[styles.hostRow, { backgroundColor: colors.surface }]} onPress={onHostPress}>
            <StatusDot status="host" />
            <View style={styles.rowContent}>
              <Text style={styles.hostRowName}>
                {hostInfo.username}@{hostInfo.hostname}
              </Text>
              <Text style={[styles.hostRowPath, { color: colors.textMuted }]}>{hostInfo.homeDir}</Text>
            </View>
            <Text style={[styles.rowChevron, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>
          <Text style={styles.hostWarning}>
            Commands run directly on your machine without isolation
          </Text>
        </>
      ) : (
        info && (
          <View style={styles.hostStats}>
            <Text style={[styles.hostStat, { color: colors.textMuted }]}>{info.workspacesCount} workspaces</Text>
            <Text style={[styles.hostStatDivider, { color: colors.textMuted }]}>•</Text>
            <Text style={[styles.hostStat, { color: colors.textMuted }]}>Docker {info.dockerVersion}</Text>
          </View>
        )
      )}
    </View>
  )
}

export function HomeScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const queryClient = useQueryClient()
  const { status } = useNetwork()
  const { colors } = useTheme()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRepo, setNewRepo] = useState('')

  const trimmedNewName = newName.trim()
  const newNameError = trimmedNewName ? getUserWorkspaceNameError(trimmedNewName) : null
  const canCreate = trimmedNewName.length > 0 && !newNameError

  const { data: workspaces, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.listWorkspaces,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateWorkspaceRequest) => api.createWorkspace(data),
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      setShowCreate(false)
      setNewName('')
      setNewRepo('')
      navigation.navigate('WorkspaceDetail', { name: workspace.name })
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.deleteWorkspace(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
    onError: (err) => {
      Alert.alert('Error', parseNetworkError(err))
    },
  })

  const confirmDeleteWorkspace = useCallback((workspace: WorkspaceInfo, onCancel?: () => void) => {
    Alert.alert(
      `Delete ${workspace.name}?`,
      'This will permanently delete the workspace and its data.',
      [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(workspace.name),
        },
      ]
    )
  }, [deleteMutation])

  const handleCreate = () => {
    const name = newName.trim()
    const error = getUserWorkspaceNameError(name)
    if (error) {
      Alert.alert('Error', error)
      return
    }

    createMutation.mutate({
      name,
      clone: newRepo.trim() || undefined,
    })
  }

  const handleWorkspacePress = useCallback((workspace: WorkspaceInfo) => {
    navigation.navigate('WorkspaceDetail', { name: workspace.name })
  }, [navigation])

  const handleHostPress = useCallback(() => {
    navigation.navigate('WorkspaceDetail', { name: HOST_WORKSPACE_NAME })
  }, [navigation])

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  if (error && status !== 'connected') {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Text style={[styles.errorIcon, { color: colors.error }]}>!</Text>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Cannot Load Workspaces</Text>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>{parseNetworkError(error)}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.accent }]} onPress={() => refetch()}>
          <Text style={[styles.retryBtnText, { color: colors.accentText }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const sortedWorkspaces = [...(workspaces || [])].sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1
    if (a.status !== 'running' && b.status === 'running') return 1
    return new Date(b.created).getTime() - new Date(a.created).getTime()
  })

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Perry</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowCreate(true)}
            testID="add-workspace-button"
          >
            <Text style={[styles.addIcon, { color: colors.accent }]}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Settings')}
            testID="settings-button"
          >
            <Text style={[styles.settingsIcon, { color: colors.textMuted }]}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={sortedWorkspaces}
        keyExtractor={(item) => item.name}
        ListHeaderComponent={<HostSection onHostPress={handleHostPress} />}
        renderItem={({ item }) => (
          <ReanimatedSwipeable
            friction={2}
            rightThreshold={40}
            renderRightActions={(_prog, drag, swipeable) => (
              <DeleteAction
                drag={drag}
                onPress={() => confirmDeleteWorkspace(item, swipeable.close)}
                color={colors.error}
              />
            )}
          >
            <WorkspaceRow
              workspace={item}
              onPress={() => handleWorkspacePress(item)}
            />
          </ReanimatedSwipeable>
        )}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No workspaces</Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Create one from the web UI or CLI</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
      />

      <Modal
        visible={showCreate}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.modalCancelBtn}>
              <Text style={[styles.modalCancelText, { color: colors.accent }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Workspace</Text>
              <TouchableOpacity
                onPress={handleCreate}
                style={styles.modalCreateBtn}
                disabled={createMutation.isPending || !canCreate}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text
                    style={[
                      styles.modalCreateText,
                      { color: colors.accent },
                      !canCreate && { color: colors.textMuted },
                    ]}
                  >
                    Create
                  </Text>
                )}
              </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Name</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text }]}
                value={newName}
                onChangeText={setNewName}
                placeholder="my-project"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {newNameError && (
                <Text style={{ color: colors.error, marginTop: 6, fontSize: 12 }}>{newNameError}</Text>
              )}
            </View>
            <RepoSelector
              value={newRepo}
              onChange={setNewRepo}
              placeholder="https://github.com/user/repo"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    fontSize: 28,
    color: '#0a84ff',
    fontWeight: '300',
  },
  settingsIcon: {
    fontSize: 22,
    color: '#8e8e93',
  },
  hostSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  hostHeader: {},
  hostLabel: {
    fontSize: 12,
    color: '#636366',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hostName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f59e0b33',
  },
  hostRowName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f59e0b',
  },
  hostRowPath: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
  },
  hostWarning: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 10,
    textAlign: 'center',
  },
  hostStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  hostStat: {
    fontSize: 13,
    color: '#8e8e93',
  },
  hostStatDivider: {
    fontSize: 13,
    color: '#636366',
    marginHorizontal: 8,
  },
  list: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowName: {
    fontSize: 17,
    fontWeight: '500',
    color: '#fff',
  },
  rowRepo: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
  },
  rowTailscale: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  rowChevron: {
    fontSize: 20,
    color: '#636366',
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#1c1c1e',
    marginLeft: 38,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
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
  errorIcon: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ff3b30',
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#0a84ff',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  modalCancelBtn: {
    paddingVertical: 8,
  },
  modalCancelText: {
    fontSize: 17,
    color: '#0a84ff',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  modalCreateBtn: {
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  modalCreateText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0a84ff',
  },
  modalCreateTextDisabled: {
    color: '#636366',
  },
  modalContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: '#8e8e93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    padding: 14,
    fontSize: 17,
    color: '#fff',
  },
  deleteAction: {
    width: DELETE_ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  deleteActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
})
