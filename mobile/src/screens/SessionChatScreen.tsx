import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  ActionSheetIOS,
  Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, AgentType, getChatUrl, HOST_WORKSPACE_NAME, ModelInfo } from '../lib/api'

const FALLBACK_CLAUDE_MODELS: ModelInfo[] = [
  { id: 'sonnet', name: 'Sonnet' },
  { id: 'opus', name: 'Opus' },
  { id: 'haiku', name: 'Haiku' },
]

interface MessagePart {
  type: 'text' | 'tool_use' | 'tool_result'
  content: string
  toolName?: string
  toolId?: string
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  id: string
  parts?: MessagePart[]
}

const MESSAGES_PER_PAGE = 100

function getToolSummary(toolName: string, content: string): string | null {
  try {
    const parsed = JSON.parse(content)
    if (toolName === 'Bash' && parsed.command) {
      const cmd = parsed.command.length > 40 ? parsed.command.slice(0, 40) + '...' : parsed.command
      return cmd
    }
    if (toolName === 'Read' && parsed.file_path) {
      return parsed.file_path.split('/').pop() || parsed.file_path
    }
    if (toolName === 'Write' && parsed.file_path) {
      return parsed.file_path.split('/').pop() || parsed.file_path
    }
    if (toolName === 'Edit' && parsed.file_path) {
      return parsed.file_path.split('/').pop() || parsed.file_path
    }
    if (toolName === 'Glob' && parsed.pattern) {
      return parsed.pattern
    }
    if (toolName === 'Grep' && parsed.pattern) {
      return parsed.pattern
    }
    if (toolName === 'Task' && parsed.description) {
      return parsed.description
    }
  } catch {
    return null
  }
  return null
}

function ToolBubble({
  toolName,
  input,
  result,
}: {
  toolName: string
  input: string
  result?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const summary = getToolSummary(toolName, input)
  const hasResult = result && result.length > 0

  return (
    <TouchableOpacity
      style={styles.toolBubble}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.toolHeader}>
        <Text style={styles.toolChevron}>{expanded ? '▼' : '▶'}</Text>
        <View style={[styles.toolStatusDot, { backgroundColor: hasResult ? '#34c759' : '#8e8e93' }]} />
        <Text style={styles.toolName}>{toolName}</Text>
        {summary && !expanded && (
          <Text style={styles.toolSummary} numberOfLines={1}>{summary}</Text>
        )}
      </View>
      {expanded && (
        <View style={styles.toolDetails}>
          {input && (
            <View style={styles.toolSection}>
              <Text style={styles.toolSectionLabel}>INPUT</Text>
              <Text style={styles.toolContent} numberOfLines={8}>
                {input.slice(0, 500)}
                {input.length > 500 ? '... (truncated)' : ''}
              </Text>
            </View>
          )}
          {hasResult && (
            <View style={styles.toolSection}>
              <Text style={styles.toolSectionLabel}>RESULT</Text>
              <Text style={[styles.toolContent, styles.toolResultContent]} numberOfLines={12}>
                {result.slice(0, 800)}
                {result.length > 800 ? '... (truncated)' : ''}
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  )
}

function renderPartsWithPairedTools(parts: MessagePart[]) {
  const elements: React.ReactNode[] = []
  const resultsByToolId = new Map<string, string>()

  for (const part of parts) {
    if (part.type === 'tool_result' && part.toolId) {
      resultsByToolId.set(part.toolId, part.content)
    }
  }

  const renderedToolIds = new Set<string>()

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const trimmedContent = part.content?.trim()
    if (part.type === 'text' && trimmedContent) {
      elements.push(
        <View key={`text-${i}`} style={styles.assistantBubble}>
          <Text style={styles.messageText}>{trimmedContent}</Text>
        </View>
      )
    } else if (part.type === 'tool_use') {
      const toolId = part.toolId || `tool-${i}`
      if (!renderedToolIds.has(toolId)) {
        renderedToolIds.add(toolId)
        const result = part.toolId ? resultsByToolId.get(part.toolId) : undefined
        elements.push(
          <ToolBubble
            key={`tool-${i}`}
            toolName={part.toolName || 'unknown'}
            input={part.content}
            result={result}
          />
        )
      }
    }
  }

  return elements
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const trimmedContent = message.content?.trim() || ''

  if (message.role === 'system') {
    return (
      <View style={styles.systemBubble}>
        <Text style={styles.systemText}>{trimmedContent}</Text>
      </View>
    )
  }

  if (message.role === 'user') {
    return (
      <View style={styles.userBubble} testID="user-message">
        <Text style={styles.messageText}>{trimmedContent}</Text>
      </View>
    )
  }

  if (message.parts && message.parts.length > 0) {
    return (
      <View style={styles.partsContainer}>
        {renderPartsWithPairedTools(message.parts)}
      </View>
    )
  }

  return (
    <View style={styles.assistantBubble} testID="assistant-message">
      <Text style={styles.messageText}>{trimmedContent}</Text>
    </View>
  )
}

function ThinkingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current
  const dot2 = useRef(new Animated.Value(0.3)).current
  const dot3 = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ])
      )
    }

    const anim1 = animate(dot1, 0)
    const anim2 = animate(dot2, 150)
    const anim3 = animate(dot3, 300)

    anim1.start()
    anim2.start()
    anim3.start()

    return () => {
      anim1.stop()
      anim2.stop()
      anim3.stop()
    }
  }, [dot1, dot2, dot3])

  return (
    <View style={styles.thinkingDots} testID="thinking-dots">
      <Animated.View style={[styles.dot, { opacity: dot1 }]} />
      <Animated.View style={[styles.dot, { opacity: dot2 }]} />
      <Animated.View style={[styles.dot, { opacity: dot3 }]} />
    </View>
  )
}

function StreamingBubble({ parts }: { parts: MessagePart[] }) {
  const hasContent = parts.some(p => p.content.length > 0)

  return (
    <View style={styles.partsContainer}>
      {renderPartsWithPairedTools(parts)}
      {!hasContent && <ThinkingDots />}
    </View>
  )
}

export function SessionChatScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets()
  const { workspaceName, sessionId: initialSessionId, agentType = 'claude-code', isNew } = route.params

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [connected, setConnected] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId || null)
  const [initialScrollDone, setInitialScrollDone] = useState(false)
  const [streamingParts, setStreamingParts] = useState<MessagePart[]>([])
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [messageOffset, setMessageOffset] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined)
  const wsRef = useRef<WebSocket | null>(null)
  const flatListRef = useRef<FlatList>(null)
  const streamingPartsRef = useRef<MessagePart[]>([])
  const messageIdCounter = useRef(0)
  const hasLoadedInitial = useRef(false)
  const modelInitialized = useRef(false)
  const isAtBottomRef = useRef(true)

  const fetchAgentType = agentType === 'opencode' ? 'opencode' : 'claude-code'

  const { data: modelsData } = useQuery({
    queryKey: ['models', fetchAgentType],
    queryFn: () => api.listModels(fetchAgentType, workspaceName),
  })

  const { data: agentsConfig } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  })

  const availableModels = useMemo(() => {
    if (modelsData?.models?.length) return modelsData.models
    if (fetchAgentType === 'claude-code') return FALLBACK_CLAUDE_MODELS
    return []
  }, [modelsData, fetchAgentType])

  useEffect(() => {
    if (availableModels.length > 0 && !modelInitialized.current) {
      modelInitialized.current = true
      const configModel = fetchAgentType === 'opencode'
        ? agentsConfig?.opencode?.model
        : agentsConfig?.claude_code?.model
      setSelectedModel(configModel || availableModels[0].id)
    }
  }, [availableModels, agentsConfig, fetchAgentType])

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true)
      if (isAtBottomRef.current) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)
      }
    })
    const hideSub = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const generateId = useCallback(() => {
    messageIdCounter.current += 1
    return `msg-${messageIdCounter.current}`
  }, [])

  const parseMessages = useCallback((rawMessages: any[]): ChatMessage[] => {
    const converted: ChatMessage[] = []
    let currentParts: MessagePart[] = []

    const flushParts = () => {
      if (currentParts.length > 0) {
        const textContent = currentParts
          .filter(p => p.type === 'text')
          .map(p => p.content)
          .join('')
        converted.push({
          role: 'assistant',
          content: textContent || '',
          id: generateId(),
          parts: [...currentParts],
        })
        currentParts = []
      }
    }

    for (const m of rawMessages) {
      if (m.type === 'user' && m.content) {
        flushParts()
        converted.push({ role: 'user', content: m.content, id: generateId() })
      } else if (m.type === 'assistant' && m.content) {
        currentParts.push({ type: 'text', content: m.content })
      } else if (m.type === 'tool_use') {
        currentParts.push({
          type: 'tool_use',
          content: m.toolInput || '',
          toolName: m.toolName,
          toolId: m.toolId,
        })
      } else if (m.type === 'tool_result') {
        currentParts.push({
          type: 'tool_result',
          content: m.content || '',
          toolId: m.toolId,
        })
      }
    }
    flushParts()

    return converted
  }, [generateId])

  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', workspaceName, initialSessionId, 'initial'],
    queryFn: () => api.getSession(workspaceName, initialSessionId, agentType, MESSAGES_PER_PAGE, 0),
    enabled: !!initialSessionId && !isNew,
  })

  useEffect(() => {
    if (sessionData?.messages && !hasLoadedInitial.current) {
      hasLoadedInitial.current = true
      const converted = parseMessages(sessionData.messages)
      setMessages(converted)
      setHasMoreMessages(sessionData.hasMore || false)
      setMessageOffset(sessionData.messages.length)
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false })
      }, 150)
      if (initialSessionId) {
        api.recordSessionAccess(workspaceName, initialSessionId, agentType).catch(() => {})
      }
    }
  }, [sessionData, parseMessages, workspaceName, initialSessionId, agentType])

  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || isLoadingMore || !initialSessionId) return

    setIsLoadingMore(true)
    try {
      const moreData = await api.getSession(workspaceName, initialSessionId, agentType, MESSAGES_PER_PAGE, messageOffset)
      if (moreData?.messages) {
        const olderMessages = parseMessages(moreData.messages)
        setMessages(prev => [...olderMessages, ...prev])
        setHasMoreMessages(moreData.hasMore || false)
        setMessageOffset(prev => prev + moreData.messages.length)
      }
    } catch (err) {
      console.error('Failed to load more messages:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [hasMoreMessages, isLoadingMore, initialSessionId, workspaceName, agentType, messageOffset, parseMessages])

  const connect = useCallback(() => {
    const url = getChatUrl(workspaceName, agentType as AgentType)
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type === 'connected') {
          return
        }

        if (msg.type === 'system') {
          if (msg.content?.startsWith('Session started') || msg.content?.includes('Session ')) {
            const match = msg.content.match(/Session (\S+)/)
            if (match) {
              setCurrentSessionId(match[1])
            }
          }
          return
        }

        if (msg.type === 'tool_use') {
          const lastPart = streamingPartsRef.current[streamingPartsRef.current.length - 1]
          if (lastPart?.type === 'text' && lastPart.content === '') {
            streamingPartsRef.current.pop()
          }
          streamingPartsRef.current.push({
            type: 'tool_use',
            content: msg.content,
            toolName: msg.toolName,
            toolId: msg.toolId,
          })
          streamingPartsRef.current.push({ type: 'text', content: '' })
          setStreamingParts([...streamingPartsRef.current])
          return
        }

        if (msg.type === 'tool_result') {
          const lastPart = streamingPartsRef.current[streamingPartsRef.current.length - 1]
          if (lastPart?.type === 'text' && lastPart.content === '') {
            streamingPartsRef.current.pop()
          }
          streamingPartsRef.current.push({
            type: 'tool_result',
            content: msg.content,
            toolId: msg.toolId,
          })
          streamingPartsRef.current.push({ type: 'text', content: '' })
          setStreamingParts([...streamingPartsRef.current])
          return
        }

        if (msg.type === 'assistant') {
          if (streamingPartsRef.current.length === 0) {
            streamingPartsRef.current.push({ type: 'text', content: '' })
          }
          const lastPart = streamingPartsRef.current[streamingPartsRef.current.length - 1]
          if (lastPart?.type === 'text') {
            lastPart.content += msg.content || ''
          } else {
            streamingPartsRef.current.push({ type: 'text', content: msg.content || '' })
          }
          setStreamingParts([...streamingPartsRef.current])
          return
        }

        if (msg.type === 'done') {
          const parts = [...streamingPartsRef.current]
          if (parts.length > 0) {
            const textContent = parts
              .filter(p => p.type === 'text')
              .map(p => p.content)
              .join('')
            setMessages((prev) => [...prev, {
              role: 'assistant',
              content: textContent || '',
              id: `msg-done-${Date.now()}`,
              parts,
            }])
          }
          streamingPartsRef.current = []
          setStreamingParts([])
          setIsStreaming(false)
          return
        }

        if (msg.type === 'error') {
          setMessages((prev) => [...prev, { role: 'system', content: `Error: ${msg.content || msg.message}`, id: `msg-err-${Date.now()}` }])
          setIsStreaming(false)
          return
        }
      } catch {
        // Non-JSON message, ignore
      }
    }

    ws.onclose = () => {
      setConnected(false)
      setIsStreaming(false)
    }

    ws.onerror = () => {
      setConnected(false)
      setIsStreaming(false)
      setMessages((prev) => [...prev, { role: 'system', content: 'Connection error', id: `msg-conn-err-${Date.now()}` }])
    }

    return () => ws.close()
  }, [workspaceName, agentType])

  useEffect(() => {
    const cleanup = connect()
    return cleanup
  }, [connect])

  useEffect(() => {
    if (streamingParts.length > 0 && isAtBottomRef.current) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)
    }
  }, [streamingParts])

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    if (contentOffset.y < 100 && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages()
    }
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y
    isAtBottomRef.current = distanceFromBottom < 100
  }, [hasMoreMessages, isLoadingMore, loadMoreMessages])

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const msg = input.trim()
    setMessages((prev) => [...prev, { role: 'user', content: msg, id: `msg-user-${Date.now()}` }])
    setInput('')
    setIsStreaming(true)
    streamingPartsRef.current = []
    setStreamingParts([])
    isAtBottomRef.current = true

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)

    const payload: Record<string, unknown> = {
      type: 'message',
      content: msg,
      sessionId: currentSessionId,
    }

    if (selectedModel) {
      payload.model = selectedModel
    }

    wsRef.current.send(JSON.stringify(payload))
  }

  const interrupt = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }))
      setIsStreaming(false)
    }
  }

  const showModelPicker = () => {
    if (availableModels.length === 0) return
    if (isStreaming) return
    if (agentType === 'opencode' && currentSessionId) return

    const options = [...availableModels.map(m => m.name), 'Cancel']
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        title: 'Select Model',
      },
      (buttonIndex) => {
        if (buttonIndex < availableModels.length) {
          const newModel = availableModels[buttonIndex].id
          if (newModel !== selectedModel) {
            setSelectedModel(newModel)
            if (agentType !== 'opencode' && currentSessionId) {
              setCurrentSessionId(null)
              setMessages(prev => [...prev, {
                role: 'system',
                content: `Switching to model: ${availableModels[buttonIndex].name}`,
                id: `msg-model-${Date.now()}`,
              }])
            }
          }
        }
      }
    )
  }

  const selectedModelName = availableModels.find(m => m.id === selectedModel)?.name || 'Model'
  const canChangeModel = !isStreaming && !(agentType === 'opencode' && currentSessionId)

  const agentLabels: Record<AgentType, string> = {
    'claude-code': 'Claude Code',
    opencode: 'OpenCode',
    codex: 'Codex',
  }

  if (sessionLoading && !isNew) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0a84ff" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, workspaceName === HOST_WORKSPACE_NAME && styles.hostTitle]}>
              {workspaceName === HOST_WORKSPACE_NAME ? 'Host' : workspaceName}
            </Text>
            <View style={[styles.connectionDot, { backgroundColor: connected ? '#34c759' : '#ff3b30' }]} />
          </View>
          <Text style={styles.headerSubtitle}>{agentLabels[agentType as AgentType]}</Text>
        </View>
        {availableModels.length > 0 && (
          <TouchableOpacity
            style={[styles.modelBtn, !canChangeModel && styles.modelBtnDisabled]}
            onPress={showModelPicker}
            disabled={!canChangeModel}
          >
            <Text style={[styles.modelBtnText, !canChangeModel && styles.modelBtnTextDisabled]}>
              {selectedModelName}
            </Text>
          </TouchableOpacity>
        )}
        {availableModels.length === 0 && <View style={styles.placeholder} />}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        ListHeaderComponent={
          isLoadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#0a84ff" />
            </View>
          ) : null
        }
        ListFooterComponent={
          isStreaming ? <StreamingBubble parts={streamingParts} /> : null
        }
        ListEmptyComponent={
          !isStreaming ? (
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>
                {isNew ? 'Start a new conversation' : 'No messages yet'}
              </Text>
            </View>
          ) : null
        }
        onScrollToIndexFailed={() => {}}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />

      <View style={[styles.inputContainer, { paddingBottom: keyboardVisible ? 8 : insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={connected ? 'Message...' : 'Connecting...'}
          placeholderTextColor="#636366"
          multiline
          maxLength={4000}
          editable={connected && !isStreaming}
          testID="chat-input"
        />
        {isStreaming ? (
          <TouchableOpacity style={styles.stopBtn} onPress={interrupt} testID="stop-button">
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, (!connected || !input.trim()) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!connected || !input.trim()}
            testID="send-button"
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  hostTitle: {
    color: '#f59e0b',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  placeholder: {
    width: 44,
  },
  modelBtn: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modelBtnDisabled: {
    opacity: 0.5,
  },
  modelBtnText: {
    fontSize: 13,
    color: '#0a84ff',
    fontWeight: '500',
  },
  modelBtnTextDisabled: {
    color: '#8e8e93',
  },
  messageList: {
    padding: 16,
    flexGrow: 1,
  },
  partsContainer: {
    gap: 8,
    marginBottom: 8,
  },
  userBubble: {
    maxWidth: '85%',
    backgroundColor: '#0a84ff',
    alignSelf: 'flex-end',
    padding: 12,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    marginBottom: 8,
  },
  assistantBubble: {
    maxWidth: '85%',
    backgroundColor: '#1c1c1e',
    alignSelf: 'flex-start',
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  systemBubble: {
    alignSelf: 'center',
    padding: 8,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
  },
  systemText: {
    fontSize: 13,
    color: '#636366',
    textAlign: 'center',
  },
  toolBubble: {
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    padding: 10,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolChevron: {
    fontSize: 10,
    color: '#8e8e93',
  },
  toolStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  toolName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toolSummary: {
    flex: 1,
    fontSize: 12,
    color: '#8e8e93',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toolDetails: {
    marginTop: 10,
    gap: 10,
  },
  toolSection: {
    gap: 4,
  },
  toolSectionLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#636366',
    letterSpacing: 0.5,
  },
  toolContent: {
    fontSize: 11,
    color: '#b0b0b0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#0d0d0d',
    padding: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  toolResultContent: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.2)',
  },
  thinkingDots: {
    flexDirection: 'row',
    gap: 4,
    padding: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#636366',
  },
  loadingMore: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyChatText: {
    fontSize: 15,
    color: '#636366',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#1c1c1e',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#fff',
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#0a84ff',
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#2c2c2e',
  },
  sendBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  stopBtn: {
    backgroundColor: '#ff3b30',
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  stopBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
})
