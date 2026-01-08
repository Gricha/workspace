import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { parseNetworkError } from '../lib/network'

export function WorkspaceSettingsScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets()
  const { name } = route.params
  const queryClient = useQueryClient()
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloneName, setCloneName] = useState('')

  const { data: workspace, isLoading } = useQuery({
    queryKey: ['workspace', name],
    queryFn: () => api.getWorkspace(name),
  })

  const startMutation = useMutation({
    mutationFn: () => api.startWorkspace(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', name] })
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
    onError: (err) => Alert.alert('Error', parseNetworkError(err)),
  })

  const stopMutation = useMutation({
    mutationFn: () => api.stopWorkspace(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', name] })
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
    onError: (err) => Alert.alert('Error', parseNetworkError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteWorkspace(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      navigation.navigate('Home')
    },
    onError: (err) => Alert.alert('Error', parseNetworkError(err)),
  })

  const syncMutation = useMutation({
    mutationFn: () => api.syncWorkspace(name),
    onSuccess: () => Alert.alert('Success', 'Credentials synced'),
    onError: (err) => Alert.alert('Error', parseNetworkError(err)),
  })

  const cloneMutation = useMutation({
    mutationFn: (newName: string) => api.cloneWorkspace(name, newName),
    onSuccess: (newWorkspace) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      setShowCloneModal(false)
      setCloneName('')
      Alert.alert('Success', `Workspace cloned as "${newWorkspace.name}"`)
      navigation.navigate('Workspace', { name: newWorkspace.name })
    },
    onError: (err) => Alert.alert('Error', parseNetworkError(err)),
  })

  const handleClone = () => {
    if (cloneName.trim()) {
      cloneMutation.mutate(cloneName.trim())
    }
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Workspace',
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ]
    )
  }

  if (isLoading || !workspace) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0a84ff" />
      </View>
    )
  }

  const isRunning = workspace.status === 'running'
  const isPending = startMutation.isPending || stopMutation.isPending || deleteMutation.isPending || syncMutation.isPending || cloneMutation.isPending

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workspace Details</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{workspace.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[styles.infoValue, { color: isRunning ? '#34c759' : '#8e8e93' }]}>
                {workspace.status}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Container ID</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {workspace.containerId.slice(0, 12)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>SSH Port</Text>
              <Text style={styles.infoValue}>{workspace.ports.ssh}</Text>
            </View>
            {workspace.repo && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Repository</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{workspace.repo}</Text>
              </View>
            )}
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>
                {new Date(workspace.created).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync</Text>
          <TouchableOpacity
            style={[styles.actionBtn, !isRunning && styles.actionBtnDisabled]}
            onPress={() => syncMutation.mutate()}
            disabled={!isRunning || isPending}
          >
            {syncMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>Sync Credentials</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.actionHint}>
            Copy environment variables and credential files to workspace
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clone</Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setCloneName('')
              setShowCloneModal(true)
            }}
            disabled={isPending}
          >
            {cloneMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>Clone Workspace</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.actionHint}>
            Create a copy of this workspace with all its data
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          {isRunning ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnWarning]}
              onPress={() => stopMutation.mutate()}
              disabled={isPending}
            >
              {stopMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Stop Workspace</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSuccess]}
              onPress={() => startMutation.mutate()}
              disabled={isPending}
            >
              {startMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Start Workspace</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#ff3b30' }]}>Danger Zone</Text>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={handleDelete}
            disabled={isPending}
          >
            {deleteMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>Delete Workspace</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.actionHint}>
            This will permanently delete the workspace and all its data
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showCloneModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCloneModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Clone Workspace</Text>
            <Text style={styles.modalDescription}>
              Create a copy of "{name}" with all its data.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="New workspace name"
              placeholderTextColor="#636366"
              value={cloneName}
              onChangeText={setCloneName}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowCloneModal(false)}
                disabled={cloneMutation.isPending}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm, !cloneName.trim() && styles.modalBtnDisabled]}
                onPress={handleClone}
                disabled={!cloneName.trim() || cloneMutation.isPending}
              >
                {cloneMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>Clone</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  placeholder: {
    width: 44,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  infoLabel: {
    fontSize: 15,
    color: '#fff',
  },
  infoValue: {
    fontSize: 15,
    color: '#8e8e93',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  actionBtn: {
    backgroundColor: '#0a84ff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnDisabled: {
    backgroundColor: '#2c2c2e',
  },
  actionBtnSuccess: {
    backgroundColor: '#34c759',
  },
  actionBtnWarning: {
    backgroundColor: '#ff9f0a',
  },
  actionBtnDanger: {
    backgroundColor: '#ff3b30',
  },
  actionBtnText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#fff',
  },
  actionHint: {
    fontSize: 13,
    color: '#636366',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 13,
    color: '#8e8e93',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 17,
    color: '#fff',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#2c2c2e',
  },
  modalBtnConfirm: {
    backgroundColor: '#0a84ff',
  },
  modalBtnDisabled: {
    backgroundColor: '#2c2c2e',
    opacity: 0.5,
  },
  modalBtnCancelText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#fff',
  },
  modalBtnConfirmText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#fff',
  },
})
