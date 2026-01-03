import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, WorkspaceInfo } from '../lib/api'

function StatusBadge({ status }: { status: WorkspaceInfo['status'] }) {
  const colors = {
    running: '#34c759',
    stopped: '#8e8e93',
    creating: '#ff9f0a',
    error: '#ff3b30',
  }
  return (
    <View style={[styles.badge, { backgroundColor: colors[status] }]}>
      <Text style={styles.badgeText}>{status}</Text>
    </View>
  )
}

function WorkspaceItem({
  workspace,
  onPress,
  onStart,
  onStop,
  onDelete,
}: {
  workspace: WorkspaceInfo
  onPress: () => void
  onStart: () => void
  onStop: () => void
  onDelete: () => void
}) {
  const isRunning = workspace.status === 'running'

  return (
    <TouchableOpacity style={styles.item} onPress={onPress}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{workspace.name}</Text>
        <StatusBadge status={workspace.status} />
      </View>
      {workspace.repo && <Text style={styles.itemRepo}>{workspace.repo}</Text>}
      <Text style={styles.itemMeta}>
        SSH: {workspace.ports.ssh} | Created: {new Date(workspace.created).toLocaleDateString()}
      </Text>
      <View style={styles.itemActions}>
        {isRunning ? (
          <TouchableOpacity style={[styles.actionBtn, styles.stopBtn]} onPress={onStop}>
            <Text style={styles.actionBtnText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.actionBtn, styles.startBtn]} onPress={onStart}>
            <Text style={styles.actionBtnText}>Start</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={onDelete}>
          <Text style={styles.actionBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

function CreateWorkspaceModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean
  onClose: () => void
  onCreate: (name: string, clone?: string) => void
}) {
  const [name, setName] = useState('')
  const [clone, setClone] = useState('')

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required')
      return
    }
    onCreate(name.trim(), clone.trim() || undefined)
    setName('')
    setClone('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create Workspace</Text>
          <TextInput
            style={styles.input}
            placeholder="Workspace name"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Clone URL (optional)"
            placeholderTextColor="#666"
            value={clone}
            onChangeText={setClone}
            autoCapitalize="none"
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtn} onPress={onClose}>
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleCreate}>
              <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export function WorkspacesScreen() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceInfo | null>(null)

  const { data: workspaces, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.listWorkspaces,
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; clone?: string }) => api.createWorkspace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
    onError: (err) => {
      Alert.alert('Error', (err as Error).message)
    },
  })

  const startMutation = useMutation({
    mutationFn: (name: string) => api.startWorkspace(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
    onError: (err) => {
      Alert.alert('Error', (err as Error).message)
    },
  })

  const stopMutation = useMutation({
    mutationFn: (name: string) => api.stopWorkspace(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
    onError: (err) => {
      Alert.alert('Error', (err as Error).message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.deleteWorkspace(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
    onError: (err) => {
      Alert.alert('Error', (err as Error).message)
    },
  })

  const handleDelete = useCallback((name: string) => {
    Alert.alert('Delete Workspace', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(name) },
    ])
  }, [deleteMutation])

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a84ff" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={workspaces || []}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <WorkspaceItem
            workspace={item}
            onPress={() => setSelectedWorkspace(item)}
            onStart={() => startMutation.mutate(item.name)}
            onStop={() => stopMutation.mutate(item.name)}
            onDelete={() => handleDelete(item.name)}
          />
        )}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0a84ff" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No workspaces yet</Text>
            <Text style={styles.emptySubtext}>Tap + to create one</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
      <CreateWorkspaceModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={(name, clone) => createMutation.mutate({ name, clone })}
      />
      {selectedWorkspace && (
        <WorkspaceDetailModal workspace={selectedWorkspace} onClose={() => setSelectedWorkspace(null)} />
      )}
    </View>
  )
}

function WorkspaceDetailModal({
  workspace,
  onClose,
}: {
  workspace: WorkspaceInfo
  onClose: () => void
}) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['workspace-logs', workspace.name],
    queryFn: () => api.getLogs(workspace.name, 50),
  })

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.detailClose}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle}>{workspace.name}</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.detailContent}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <StatusBadge status={workspace.status} />
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>SSH Port</Text>
            <Text style={styles.detailValue}>{workspace.ports.ssh}</Text>
          </View>
          {workspace.repo && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Repository</Text>
              <Text style={styles.detailValue}>{workspace.repo}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>{new Date(workspace.created).toLocaleString()}</Text>
          </View>
          <Text style={styles.logsTitle}>Logs</Text>
          {isLoading ? (
            <ActivityIndicator size="small" color="#0a84ff" />
          ) : (
            <Text style={styles.logs}>{logs || 'No logs'}</Text>
          )}
        </View>
      </View>
    </Modal>
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
  list: {
    padding: 16,
  },
  item: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  itemRepo: {
    fontSize: 13,
    color: '#8e8e93',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: '#636366',
    marginBottom: 12,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  startBtn: {
    backgroundColor: '#34c759',
  },
  stopBtn: {
    backgroundColor: '#ff9f0a',
  },
  deleteBtn: {
    backgroundColor: '#ff3b30',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalBtnPrimary: {
    backgroundColor: '#0a84ff',
  },
  modalBtnText: {
    fontSize: 16,
    color: '#8e8e93',
  },
  modalBtnTextPrimary: {
    color: '#fff',
    fontWeight: '600',
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
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  detailContent: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  detailLabel: {
    fontSize: 14,
    color: '#8e8e93',
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    maxWidth: '60%',
    textAlign: 'right',
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 12,
  },
  logs: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#8e8e93',
    backgroundColor: '#1c1c1e',
    padding: 12,
    borderRadius: 8,
  },
})
