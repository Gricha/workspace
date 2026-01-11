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
  AppState,
  Linking,
} from 'react-native'
import Markdown from 'react-native-markdown-display'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, AgentType, getChatUrl, HOST_WORKSPACE_NAME, ModelInfo } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'
import { ThemeColors } from '../lib/themes'

const FALLBACK_CLAUDE_MODELS: ModelInfo[] = [
  { id: 'sonnet', name: 'Sonnet' },
  { id: 'opus', name: 'Opus' },
  { id: 'haiku', name: 'Haiku' },
]

interface MessagePart {
  type: 'text' | 'tool_use' | 'tool_result'
  content: string
  messageId?: string
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

function getMarkdownStyles(colors: ThemeColors, isUser: boolean = false) {
  const textColor = isUser ? colors.accentText : colors.text
  const codeBackground = isUser ? 'rgba(0,0,0,0.15)' : colors.background
  return {
    body: { color: textColor, fontSize: 15, lineHeight: 22 },
    paragraph: { marginTop: 0, marginBottom: 8 },
    heading1: { fontSize: 20, fontWeight: '700' as const, color: textColor, marginTop: 12, marginBottom: 6 },
    heading2: { fontSize: 18, fontWeight: '600' as const, color: textColor, marginTop: 10, marginBottom: 4 },
    heading3: { fontSize: 16, fontWeight: '600' as const, color: textColor, marginTop: 8, marginBottom: 4 },
    code_inline: {
      backgroundColor: codeBackground,
      color: textColor,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
    },
    fence: {
      backgroundColor: codeBackground,
      color: textColor,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      padding: 10,
      borderRadius: 6,
      marginVertical: 8,
    },
    code_block: {
      backgroundColor: codeBackground,
      color: textColor,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      padding: 10,
      borderRadius: 6,
    },
    link: { color: isUser ? colors.accentText : colors.accent, textDecorationLine: 'underline' as const },
    blockquote: {
      backgroundColor: codeBackground,
      borderLeftColor: colors.accent,
      borderLeftWidth: 3,
      paddingLeft: 10,
      paddingVertical: 4,
      marginVertical: 8,
    },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    strong: { fontWeight: '700' as const },
    em: { fontStyle: 'italic' as const },
  }
}

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

interface ToolItem {
  toolName: string
  input: string
  result?: string
  key: string
}

function ExpandableToolRow({
  toolName,
  input,
  result,
  isFirst,
  isLast,
  isGrouped,
  colors,
}: {
  toolName: string
  input: string
  result?: string
  isFirst: boolean
  isLast: boolean
  isGrouped: boolean
  colors: ThemeColors
}) {
  const [expanded, setExpanded] = useState(false)
  const summary = getToolSummary(toolName, input)
  const hasResult = result && result.length > 0

  const displayText = summary ? `${toolName} - ${summary}` : toolName

  return (
    <TouchableOpacity
      style={[
        styles.compactToolRow,
        isGrouped && !isFirst && [styles.compactToolRowGrouped, { borderTopColor: colors.surfaceSecondary }],
        isGrouped && isFirst && styles.compactToolRowFirst,
        isGrouped && isLast && styles.compactToolRowLast,
        !isGrouped && [styles.compactToolRowSingle, { backgroundColor: colors.surface, borderColor: colors.surfaceSecondary }],
      ]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.compactToolHeader}>
        <Text style={[styles.toolChevron, { color: colors.textMuted }]}>{expanded ? '▼' : '▶'}</Text>
        <View style={[styles.toolStatusDot, { backgroundColor: hasResult ? colors.success : colors.textMuted }]} />
        <Text style={[styles.compactToolText, { color: colors.text }]} numberOfLines={1}>{displayText}</Text>
      </View>
      {expanded && (
        <View style={styles.toolDetails}>
          {input && (
            <View style={styles.toolSection}>
              <Text style={[styles.toolSectionLabel, { color: colors.textMuted }]}>INPUT</Text>
              <Text style={[styles.toolContent, { color: colors.textSecondary, backgroundColor: colors.background }]} numberOfLines={8}>
                {input.slice(0, 500)}
                {input.length > 500 ? '... (truncated)' : ''}
              </Text>
            </View>
          )}
          {hasResult && (
            <View style={styles.toolSection}>
              <Text style={[styles.toolSectionLabel, { color: colors.textMuted }]}>RESULT</Text>
              <Text style={[styles.toolContent, styles.toolResultContent, { color: colors.textSecondary, backgroundColor: `${colors.success}15`, borderColor: `${colors.success}33` }]} numberOfLines={12}>
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

function ToolGroup({ tools, colors }: { tools: ToolItem[]; colors: ThemeColors }) {
  const isGrouped = tools.length > 1

  return (
    <View style={[styles.toolGroup, isGrouped && [styles.toolGroupMultiple, { backgroundColor: colors.surface, borderColor: colors.surfaceSecondary }]]}>
      {tools.map((tool, index) => (
        <ExpandableToolRow
          key={tool.key}
          toolName={tool.toolName}
          input={tool.input}
          result={tool.result}
          isFirst={index === 0}
          isLast={index === tools.length - 1}
          isGrouped={isGrouped}
          colors={colors}
        />
      ))}
    </View>
  )
}

function renderPartsWithPairedTools(parts: MessagePart[], colors: ThemeColors) {
  const elements: React.ReactNode[] = []
  const resultsByToolId = new Map<string, string>()

  for (const part of parts) {
    if (part.type === 'tool_result' && part.toolId) {
      resultsByToolId.set(part.toolId, part.content)
    }
  }

  const renderedToolIds = new Set<string>()
  let pendingTools: ToolItem[] = []

  const flushTools = () => {
    if (pendingTools.length > 0) {
      elements.push(
        <ToolGroup key={`toolgroup-${pendingTools[0].key}`} tools={pendingTools} colors={colors} />
      )
      pendingTools = []
    }
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const trimmedContent = part.content?.trim()
    if (part.type === 'text' && trimmedContent) {
      flushTools()
      elements.push(
        <View key={`text-${i}`} style={[styles.assistantBubble, { backgroundColor: colors.surface }]}>
          <Markdown
            style={getMarkdownStyles(colors)}
            onLinkPress={(url) => { Linking.openURL(url).catch(() => {}); return false }}
          >
            {trimmedContent}
          </Markdown>
        </View>
      )
    } else if (part.type === 'tool_use') {
      const toolId = part.toolId || `tool-${i}`
      if (!renderedToolIds.has(toolId)) {
        renderedToolIds.add(toolId)
        const result = part.toolId ? resultsByToolId.get(part.toolId) : undefined
        pendingTools.push({
          toolName: part.toolName || 'unknown',
          input: part.content,
          result,
          key: `tool-${i}`,
        })
      }
    }
  }

  flushTools()

  return elements
}

function MessageBubble({ message, colors }: { message: ChatMessage; colors: ThemeColors }) {
  const trimmedContent = message.content?.trim() || ''

  if (message.role === 'system') {
    return (
      <View style={styles.systemBubble}>
        <Text style={[styles.systemText, { color: colors.textMuted }]}>{trimmedContent}</Text>
      </View>
    )
  }

  if (message.role === 'user') {
    return (
      <View style={[styles.userBubble, { backgroundColor: colors.accent }]} testID="user-message">
        <Markdown
          style={getMarkdownStyles(colors, true)}
          onLinkPress={(url) => { Linking.openURL(url).catch(() => {}); return false }}
        >
          {trimmedContent}
        </Markdown>
      </View>
    )
  }

  if (message.parts && message.parts.length > 0) {
    return (
      <View style={styles.partsContainer}>
        {renderPartsWithPairedTools(message.parts, colors)}
      </View>
    )
  }

  return (
    <View style={[styles.assistantBubble, { backgroundColor: colors.surface }]} testID="assistant-message">
      <Markdown
        style={getMarkdownStyles(colors)}
        onLinkPress={(url) => { Linking.openURL(url).catch(() => {}); return false }}
      >
        {trimmedContent}
      </Markdown>
    </View>
  )
}

function ThinkingDots({ colors }: { colors: ThemeColors }) {
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
      <Animated.View style={[styles.dot, { opacity: dot1, backgroundColor: colors.textMuted }]} />
      <Animated.View style={[styles.dot, { opacity: dot2, backgroundColor: colors.textMuted }]} />
      <Animated.View style={[styles.dot, { opacity: dot3, backgroundColor: colors.textMuted }]} />
    </View>
  )
}

function StreamingBubble({ parts, colors }: { parts: MessagePart[]; colors: ThemeColors }) {
  return (
    <View style={styles.partsContainer}>
      {renderPartsWithPairedTools(parts, colors)}
      <ThinkingDots colors={colors} />
    </View>
  )
}

export function SessionChatScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const {
    workspaceName,
    sessionId: initialSessionId,
    agentSessionId: initialAgentSessionId,
    agentType = 'claude-code',
    isNew,
    projectPath,
  } = route.params

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [connected, setConnected] = useState(false)
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null)
  const [agentSessionId, setAgentSessionId] = useState<string | null>(initialAgentSessionId || null)
  const [streamingParts, setStreamingParts] = useState<MessagePart[]>([])
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [messageOffset, setMessageOffset] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined)
  const selectedModelRef = useRef<string | undefined>(undefined)
  selectedModelRef.current = selectedModel
  const wsRef = useRef<WebSocket | null>(null)
  const flatListRef = useRef<FlatList>(null)
  const streamingPartsRef = useRef<MessagePart[]>([])
  const messageIdCounter = useRef(0)
  const hasLoadedInitial = useRef(false)
  const modelInitialized = useRef(false)
  const isAtBottomRef = useRef(true)
  const seenMessageChunksRef = useRef<Set<string>>(new Set())
  const currentMessageIdRef = useRef<string | undefined>(undefined)

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
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false))
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        Keyboard.dismiss()
      }
    })
    return () => {
      showSub.remove()
      hideSub.remove()
      appStateSub.remove()
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
    queryFn: () => api.getSession(workspaceName, initialSessionId, agentType, MESSAGES_PER_PAGE, 0, projectPath),
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
      const moreData = await api.getSession(workspaceName, initialSessionId, agentType, MESSAGES_PER_PAGE, messageOffset, projectPath)
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
  }, [hasMoreMessages, isLoadingMore, initialSessionId, workspaceName, agentType, messageOffset, parseMessages, projectPath])

  const connect = useCallback(() => {
    const url = getChatUrl(workspaceName, agentType as AgentType)
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      const connectMsg: Record<string, unknown> = {
        type: 'connect',
        agentType: agentType === 'opencode' ? 'opencode' : 'claude',
      }
      const sessionIdForLookup = liveSessionId || initialSessionId
      if (sessionIdForLookup) {
        connectMsg.sessionId = sessionIdForLookup
      }
      if (selectedModelRef.current) {
        connectMsg.model = selectedModelRef.current
      }
      if (projectPath) {
        connectMsg.projectPath = projectPath
      }
      ws.send(JSON.stringify(connectMsg))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type === 'connected') {
          return
        }

        if (msg.type === 'session_started' || msg.type === 'session_joined') {
          if (msg.sessionId) {
            setLiveSessionId(msg.sessionId)
            api.recordSessionAccess(workspaceName, msg.sessionId, agentType).catch(() => {})
          }
          if (msg.agentSessionId) {
            setAgentSessionId(msg.agentSessionId)
          }
          if (msg.type === 'session_joined' && msg.status === 'running') {
            setIsStreaming(true)
            setStreamingParts([...streamingPartsRef.current])
          }
          return
        }

        if (msg.type === 'system') {
          try {
            const parsed = JSON.parse(msg.content)
            if (parsed.agentSessionId) {
              setAgentSessionId(parsed.agentSessionId)
              return
            }
          } catch {
            // Not JSON, check for skip patterns
          }
          if (msg.content?.startsWith('Session started') || msg.content?.startsWith('Connected to session')) {
            return
          }
          return
        }

        if (msg.type === 'user') {
          const dedupKey = msg.messageId
            ? `user:${msg.messageId}`
            : `user:${msg.timestamp}:${msg.content}`
          if (seenMessageChunksRef.current.has(dedupKey)) {
            return
          }
          seenMessageChunksRef.current.add(dedupKey)
          setMessages((prev) => {
            const lastUserMsg = [...prev].reverse().find(m => m.role === 'user')
            if (lastUserMsg && lastUserMsg.content === msg.content) {
              return prev
            }
            return [...prev, { role: 'user', content: msg.content || '', id: `msg-replay-${Date.now()}-${Math.random()}` }]
          })
          return
        }

        if (msg.type === 'tool_use') {
          if (msg.messageId) {
            currentMessageIdRef.current = msg.messageId
          }
          const dedupKey = `tool_use:${msg.toolId}`
          if (seenMessageChunksRef.current.has(dedupKey)) {
            return
          }
          seenMessageChunksRef.current.add(dedupKey)

          const lastPart = streamingPartsRef.current[streamingPartsRef.current.length - 1]
          if (lastPart?.type === 'text' && lastPart.content === '') {
            streamingPartsRef.current.pop()
          }
          streamingPartsRef.current.push({
            type: 'tool_use',
            content: msg.content,
            messageId: msg.messageId,
            toolName: msg.toolName,
            toolId: msg.toolId,
          })
          streamingPartsRef.current.push({ type: 'text', content: '', messageId: msg.messageId })
          setStreamingParts([...streamingPartsRef.current])
          return
        }

        if (msg.type === 'tool_result') {
          if (msg.messageId) {
            currentMessageIdRef.current = msg.messageId
          }
          const dedupKey = `tool_result:${msg.toolId}`
          if (seenMessageChunksRef.current.has(dedupKey)) {
            return
          }
          seenMessageChunksRef.current.add(dedupKey)

          const lastPart = streamingPartsRef.current[streamingPartsRef.current.length - 1]
          if (lastPart?.type === 'text' && lastPart.content === '') {
            streamingPartsRef.current.pop()
          }
          streamingPartsRef.current.push({
            type: 'tool_result',
            content: msg.content,
            messageId: msg.messageId,
            toolId: msg.toolId,
          })
          streamingPartsRef.current.push({ type: 'text', content: '', messageId: msg.messageId })
          setStreamingParts([...streamingPartsRef.current])
          return
        }

        if (msg.type === 'assistant') {
          if (msg.messageId) {
            currentMessageIdRef.current = msg.messageId
          }

          if (streamingPartsRef.current.length === 0) {
            streamingPartsRef.current.push({ type: 'text', content: '', messageId: msg.messageId })
          }
          const lastPart = streamingPartsRef.current[streamingPartsRef.current.length - 1]
          if (lastPart?.type === 'text') {
            lastPart.content += msg.content || ''
            if (msg.messageId) lastPart.messageId = msg.messageId
          } else {
            streamingPartsRef.current.push({ type: 'text', content: msg.content || '', messageId: msg.messageId })
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
          currentMessageIdRef.current = undefined
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
      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        setConnected(false)
        setIsStreaming(false)
        setMessages((prev) => [...prev, { role: 'system', content: 'Connection error', id: `msg-conn-err-${Date.now()}` }])
      }
    }

    return () => ws.close()
  }, [workspaceName, agentType, liveSessionId, agentSessionId, projectPath])

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
    if (agentType === 'opencode' && agentSessionId) return

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
            if (agentType !== 'opencode' && agentSessionId) {
              setAgentSessionId(null)
              setLiveSessionId(null)
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
  const canChangeModel = !isStreaming && !(agentType === 'opencode' && agentSessionId)

  const agentLabels: Record<AgentType, string> = {
    'claude-code': 'Claude Code',
    opencode: 'OpenCode',
    codex: 'Codex',
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.accent }]}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.text }, workspaceName === HOST_WORKSPACE_NAME && { color: colors.warning }]}>
              {workspaceName === HOST_WORKSPACE_NAME ? 'Host' : workspaceName}
            </Text>
            <View style={[styles.connectionDot, { backgroundColor: connected ? colors.success : colors.error }]} />
          </View>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>{agentLabels[agentType as AgentType]}</Text>
        </View>
        {availableModels.length > 0 && (
          <TouchableOpacity
            style={[styles.modelBtn, { backgroundColor: colors.surface }, !canChangeModel && styles.modelBtnDisabled]}
            onPress={showModelPicker}
            disabled={!canChangeModel}
          >
            <Text style={[styles.modelBtnText, { color: colors.accent }, !canChangeModel && { color: colors.textMuted }]}>
              {selectedModelName}
            </Text>
          </TouchableOpacity>
        )}
        {availableModels.length === 0 && <View style={styles.placeholder} />}
      </View>

      {sessionLoading && !isNew ? (
        <View style={[styles.loadingContainer]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} colors={colors} />}
        contentContainerStyle={styles.messageList}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        ListHeaderComponent={
          isLoadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : null
        }
        ListFooterComponent={
          isStreaming ? <StreamingBubble parts={streamingParts} colors={colors} /> : null
        }
        ListEmptyComponent={
          !isStreaming ? (
            <View style={styles.emptyChat}>
              <Text style={[styles.emptyChatText, { color: colors.textMuted }]}>
                {isNew ? 'Start a new conversation' : 'No messages yet'}
              </Text>
            </View>
          ) : null
        }
        onScrollToIndexFailed={() => {}}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />
      )}

      <View style={[styles.inputContainer, { paddingBottom: keyboardVisible ? 8 : insets.bottom + 8, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
          value={input}
          onChangeText={setInput}
          placeholder={connected ? 'Message...' : 'Connecting...'}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={4000}
          editable={connected && !isStreaming}
          testID="chat-input"
        />
        {isStreaming ? (
          <TouchableOpacity style={[styles.stopBtn, { backgroundColor: colors.error }]} onPress={interrupt} testID="stop-button">
            <Text style={[styles.stopBtnText, { color: colors.accentText }]}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.accent }, (!connected || !input.trim()) && [styles.sendBtnDisabled, { backgroundColor: colors.surfaceSecondary }]]}
            onPress={sendMessage}
            disabled={!connected || !input.trim()}
            testID="send-button"
          >
            <Text style={[styles.sendBtnText, { color: colors.accentText }]}>Send</Text>
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
  loadingContainer: {
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
  toolChevron: {
    fontSize: 10,
    color: '#8e8e93',
  },
  toolStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    alignItems: 'flex-end',
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
    height: 40,
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
    height: 40,
    justifyContent: 'center',
  },
  stopBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  toolGroup: {
    alignSelf: 'flex-start',
    maxWidth: '95%',
  },
  toolGroupMultiple: {
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    overflow: 'hidden',
  },
  compactToolRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  compactToolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactToolRowSingle: {
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  compactToolRowFirst: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  compactToolRowLast: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  compactToolRowGrouped: {
    borderTopWidth: 1,
    borderTopColor: '#2c2c2e',
  },
  compactToolText: {
    fontSize: 13,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flexShrink: 1,
  },
})
