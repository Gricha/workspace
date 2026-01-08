import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api, type GitHubRepo } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

interface RepoSelectorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function RepoSelector({
  value,
  onChange,
  placeholder = 'https://github.com/user/repo',
}: RepoSelectorProps) {
  const { colors } = useTheme()
  const [mode, setMode] = useState<'github' | 'manual'>('github')
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['githubRepos', debouncedSearch],
    queryFn: () => api.listGitHubRepos(debouncedSearch || undefined, 20),
    staleTime: 60000,
  })

  const isConfigured = data?.configured ?? false
  const repos = data?.repos ?? []

  const handleSelect = (repo: GitHubRepo) => {
    onChange(repo.cloneUrl)
    setIsOpen(false)
    setSearch('')
  }

  const switchToManual = () => {
    setMode('manual')
    setIsOpen(false)
    setSearch('')
  }

  const switchToGithub = () => {
    setMode('github')
    onChange('')
  }

  if (!isConfigured) {
    return (
      <View>
        <Text style={[styles.label, { color: colors.textMuted }]}>Repository (optional)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </View>
    )
  }

  if (mode === 'manual') {
    return (
      <View>
        <Text style={[styles.label, { color: colors.textMuted }]}>Repository (optional)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TouchableOpacity onPress={switchToGithub} style={styles.switchButton}>
          <Text style={[styles.githubIcon, { color: colors.textMuted }]}>GH</Text>
          <Text style={[styles.switchText, { color: colors.textMuted }]}>or select from GitHub</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View>
      <Text style={[styles.label, { color: colors.textMuted }]}>Repository (optional)</Text>
      <TouchableOpacity
        style={[styles.searchButton, { backgroundColor: colors.surface }]}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.githubIconLarge, { color: colors.textMuted }]}>GH</Text>
        <Text
          style={[styles.searchPlaceholder, { color: value ? colors.text : colors.textMuted }]}
          numberOfLines={1}
        >
          {value || 'Search your repositories...'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={switchToManual} style={styles.switchButton}>
        <Text style={[styles.switchText, { color: colors.textMuted }]}>or type in any repository URL</Text>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: colors.accent }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Repository</Text>
            <View style={styles.cancelBtn} />
          </View>

          <View style={[styles.searchContainer, { borderBottomColor: colors.border }]}>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.surface, color: colors.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search repositories..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {isLoading && (
              <ActivityIndicator
                size="small"
                color={colors.accent}
                style={styles.searchLoader}
              />
            )}
          </View>

          {isLoading && !search ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : repos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {search ? 'No repositories found' : 'Start typing to search'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={repos}
              keyExtractor={(item) => item.fullName}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.repoRow, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={[styles.repoIcon, { color: colors.textMuted }]}>
                    {item.private ? '🔒' : '🌐'}
                  </Text>
                  <View style={styles.repoContent}>
                    <Text style={[styles.repoName, { color: colors.text }]} numberOfLines={1}>
                      {item.fullName}
                    </Text>
                    {item.description && (
                      <Text style={[styles.repoDesc, { color: colors.textMuted }]} numberOfLines={1}>
                        {item.description}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 10,
    padding: 14,
    fontSize: 17,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  githubIcon: {
    fontSize: 12,
    fontWeight: '600',
  },
  githubIconLarge: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchPlaceholder: {
    fontSize: 17,
    flex: 1,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  switchText: {
    fontSize: 13,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cancelBtn: {
    minWidth: 60,
  },
  cancelText: {
    fontSize: 17,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  searchLoader: {
    position: 'absolute',
    right: 28,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  repoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  repoIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  repoContent: {
    flex: 1,
  },
  repoName: {
    fontSize: 16,
    fontWeight: '500',
  },
  repoDesc: {
    fontSize: 14,
    marginTop: 2,
  },
})
