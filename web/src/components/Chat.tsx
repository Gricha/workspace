import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, StopCircle, Bot, Sparkles, Wrench, ChevronDown, CheckCircle2, Loader2, Code2, ArrowLeft } from 'lucide-react'
import Markdown from 'react-markdown'
import { useVirtualizer } from '@tanstack/react-virtual'
import { getChatUrl, api, type AgentType, type SessionMessage, type ModelInfo } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface ChatMessagePart {
  type: 'text' | 'tool_use' | 'tool_result'
  content: string
  messageId?: string
  toolName?: string
  toolId?: string
}

interface ChatMessage {
  type: 'user' | 'assistant' | 'system' | 'error'
  content: string
  timestamp: string
  parts?: ChatMessagePart[]
  turnId?: number
}

interface RawMessage {
  type:
    | 'user'
    | 'assistant'
    | 'system'
    | 'tool_use'
    | 'tool_result'
    | 'error'
    | 'done'
    | 'connected'
    | 'session_started'
    | 'session_joined'
  content: string
  timestamp: string
  messageId?: string
  toolName?: string
  toolId?: string
}

interface ChatProps {
  workspaceName: string
  sessionId?: string
  projectPath?: string
  onSessionId?: (sessionId: string) => void
  agentType?: AgentType
  hideHeader?: boolean
  onConnectionChange?: (connected: boolean) => void
  onBack?: () => void
}

function getToolSummary(toolName: string, content: string): string | null {
  try {
    const parsed = JSON.parse(content)
    if (toolName === 'Bash' && parsed.command) {
      const cmd = parsed.command.length > 60 ? parsed.command.slice(0, 60) + '...' : parsed.command
      return cmd
    }
    if (toolName === 'Read' && parsed.file_path) {
      return parsed.file_path
    }
    if (toolName === 'Write' && parsed.file_path) {
      return parsed.file_path
    }
    if (toolName === 'Edit' && parsed.file_path) {
      return parsed.file_path
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
  result
}: {
  toolName: string
  input: string
  result?: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const summary = getToolSummary(toolName, input)
  const hasResult = result && result.length > 0

  return (
    <div className="ml-0 mt-1">
      <div className="bg-secondary/50 border border-border rounded-lg px-3 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs text-foreground/80 hover:text-foreground transition-colors w-full text-left"
        >
          <ChevronDown
            className={cn('h-3 w-3 transition-transform flex-shrink-0', isExpanded && 'rotate-180')}
          />
          {hasResult ? (
            <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-success" />
          ) : (
            <Wrench className="h-3 w-3 flex-shrink-0" />
          )}
          <span className="font-mono font-medium flex-shrink-0">{toolName}</span>
          {summary && !isExpanded && (
            <span className="font-mono text-muted-foreground truncate">{summary}</span>
          )}
        </button>
        {isExpanded && (
          <div className="mt-2 space-y-2">
            {input && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Input</div>
                <pre className="p-2 bg-muted/50 rounded text-xs overflow-x-auto max-h-32 overflow-y-auto border border-border/50 text-foreground/90">
                  {input.slice(0, 500)}
                  {input.length > 500 && '... (truncated)'}
                </pre>
              </div>
            )}
            {hasResult && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Result</div>
                <pre className="p-2 bg-success/5 rounded text-xs overflow-x-auto max-h-32 overflow-y-auto border border-success/20 whitespace-pre-wrap text-foreground/90">
                  {result.slice(0, 1000)}
                  {result.length > 1000 && '... (truncated)'}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-primary text-primary-foreground rounded-tr-sm">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  )
}

function AssistantText({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-a:text-primary prose-code:text-foreground prose-pre:text-foreground/90 prose-li:text-foreground prose-blockquote:text-muted-foreground prose-blockquote:border-border">
      <Markdown>{content}</Markdown>
    </div>
  )
}

function renderPartsWithPairedTools(parts: ChatMessagePart[]) {
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
    if (part.type === 'text' && part.content) {
      elements.push(<AssistantText key={i} content={part.content} />)
    } else if (part.type === 'tool_use') {
      const toolId = part.toolId || `tool-${i}`
      if (!renderedToolIds.has(toolId)) {
        renderedToolIds.add(toolId)
        const result = part.toolId ? resultsByToolId.get(part.toolId) : undefined
        elements.push(
          <ToolBubble
            key={i}
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
  if (message.type === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  if (message.type === 'error') {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-destructive bg-destructive/10 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  if (message.type === 'user') {
    return <UserBubble content={message.content} />
  }

  if (message.parts && message.parts.length > 0) {
    return (
      <div className="space-y-3">
        {renderPartsWithPairedTools(message.parts)}
      </div>
    )
  }

  return <AssistantText content={message.content} />
}

function StreamingMessage({ parts }: { parts: ChatMessagePart[] }) {
  return (
    <div className="space-y-3">
      {renderPartsWithPairedTools(parts)}
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

const MESSAGES_PER_PAGE = 50

export function Chat({ workspaceName, sessionId: initialSessionId, projectPath, onSessionId, agentType = 'claude-code', hideHeader, onConnectionChange, onBack }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(!!initialSessionId)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [messageOffset, setMessageOffset] = useState(0)
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined)
  const [modelLoaded, setModelLoaded] = useState(false)
  const selectedModelRef = useRef<string | undefined>(undefined)
  selectedModelRef.current = selectedModel
  const sessionIdRef = useRef<string | undefined>(initialSessionId)
  sessionIdRef.current = sessionId
  const onSessionIdRef = useRef(onSessionId)
  onSessionIdRef.current = onSessionId

  const parseMessages = useCallback((rawMessages: SessionMessage[]): ChatMessage[] => {
    const historicalMessages: ChatMessage[] = []
    let currentAssistantParts: ChatMessagePart[] = []

    const flushAssistantParts = () => {
      if (currentAssistantParts.length > 0) {
        const textContent = currentAssistantParts
          .filter(p => p.type === 'text')
          .map(p => p.content)
          .join('')
        historicalMessages.push({
          type: 'assistant',
          content: textContent || '',
          timestamp: new Date().toISOString(),
          parts: [...currentAssistantParts],
        })
        currentAssistantParts = []
      }
    }

    for (const m of rawMessages) {
      if (m.type === 'user') {
        flushAssistantParts()
        historicalMessages.push({
          type: 'user',
          content: m.content || '',
          timestamp: m.timestamp || new Date().toISOString(),
        })
      } else if (m.type === 'assistant') {
        currentAssistantParts.push({
          type: 'text',
          content: m.content || '',
        })
      } else if (m.type === 'tool_use') {
        currentAssistantParts.push({
          type: 'tool_use',
          content: m.toolInput || '',
          toolName: m.toolName,
          toolId: m.toolId,
        })
      } else if (m.type === 'tool_result') {
        currentAssistantParts.push({
          type: 'tool_result',
          content: m.content || '',
          toolId: m.toolId,
        })
      }
    }
    flushAssistantParts()

    return historicalMessages
  }, [])

  const hasLoadedHistoryRef = useRef(false)

  useEffect(() => {
    if (!initialSessionId || !workspaceName) return
    if (hasLoadedHistoryRef.current) return

    hasLoadedHistoryRef.current = true
    setIsLoadingHistory(true)
    api.getSession(workspaceName, initialSessionId, agentType, MESSAGES_PER_PAGE, 0)
      .then((detail) => {
        if (detail?.messages) {
          const historicalMessages = parseMessages(detail.messages as SessionMessage[])
          setMessages(historicalMessages)
          setHasMoreMessages(detail.hasMore)
          setMessageOffset(MESSAGES_PER_PAGE)
        }
      })
      .catch((err) => {
        console.error('Failed to load session history:', err)
      })
      .finally(() => {
        setIsLoadingHistory(false)
      })
  }, [initialSessionId, workspaceName, agentType, parseMessages])

  useEffect(() => {
    let active = true
    const fetchAgentType = agentType === 'opencode' ? 'opencode' : 'claude-code'

    api.listModels(fetchAgentType, workspaceName)
      .then(async ({ models }) => {
        if (!active) return

        setAvailableModels(models)

        if (models.length === 0) {
          setModelLoaded(true)
          return
        }

        const current = selectedModelRef.current
        const isCurrentValid = current ? models.some((m) => m.id === current) : false
        if (isCurrentValid) {
          setModelLoaded(true)
          return
        }

        const pickDefault = (configModel?: string) => {
          if (configModel && models.some((m) => m.id === configModel)) {
            return configModel
          }

          if (fetchAgentType === 'opencode') {
            const preferred = [
              'opencode/claude-opus-4-5',
              'opencode/claude-sonnet-4-5',
              'opencode/claude-opus-4-1',
              'opencode/claude-sonnet-4',
            ]
            const match = preferred.find((id) => models.some((m) => m.id === id))
            return match || models[0].id
          }

          if (models.some((m) => m.id === 'sonnet')) {
            return 'sonnet'
          }

          return models[0].id
        }

        const hasUserSelected = () => {
          const curr = selectedModelRef.current
          return curr && models.some((m) => m.id === curr)
        }

        try {
          const agents = await api.getAgents()
          if (!active || hasUserSelected()) {
            setModelLoaded(true)
            return
          }

          const configModel = fetchAgentType === 'opencode'
            ? agents.opencode?.model
            : agents.claude_code?.model
          setSelectedModel(pickDefault(configModel))
          setModelLoaded(true)
        } catch {
          if (!active || hasUserSelected()) {
            setModelLoaded(true)
            return
          }
          setSelectedModel(pickDefault())
          setModelLoaded(true)
        }
      })
      .catch((err) => {
        if (!active) return
        console.error('Failed to load models:', err)
        setModelLoaded(true) // Still allow connection even if model loading fails
      })

    return () => {
      active = false
    }
  }, [agentType, workspaceName])

  const streamingPartsRef = useRef<ChatMessagePart[]>([])
  const [streamingParts, setStreamingParts] = useState<ChatMessagePart[]>([])
  const turnIdRef = useRef(0)
  const seenMessageChunksRef = useRef<Set<string>>(new Set())
  const currentMessageIdRef = useRef<string | undefined>(undefined)

  const wsRef = useRef<WebSocket | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const [containerMounted, setContainerMounted] = useState(false)

  useEffect(() => {
    if (scrollContainerRef.current) {
      setContainerMounted(true)
    }
  }, [])

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 80,
    overscan: 5,
    enabled: containerMounted,
  })

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current && shouldAutoScrollRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  const loadMoreMessages = useCallback(async () => {
    if (!initialSessionId || !workspaceName || isLoadingMore || !hasMoreMessages) return

    setIsLoadingMore(true)
    const scrollContainer = scrollContainerRef.current
    const previousScrollHeight = scrollContainer?.scrollHeight || 0

    try {
      const detail = await api.getSession(workspaceName, initialSessionId, agentType, MESSAGES_PER_PAGE, messageOffset)
      if (detail?.messages) {
        const olderMessages = parseMessages(detail.messages as SessionMessage[])
        setMessages(prev => [...olderMessages, ...prev])
        setHasMoreMessages(detail.hasMore)
        setMessageOffset(prev => prev + MESSAGES_PER_PAGE)

        requestAnimationFrame(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight
            scrollContainer.scrollTop = newScrollHeight - previousScrollHeight
          }
        })
      }
    } catch (err) {
      console.error('Failed to load more messages:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [initialSessionId, workspaceName, agentType, isLoadingMore, hasMoreMessages, messageOffset, parseMessages])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      shouldAutoScrollRef.current = isNearBottom

      if (scrollTop < 100 && hasMoreMessages && !isLoadingMore) {
        loadMoreMessages()
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [hasMoreMessages, isLoadingMore, loadMoreMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingParts, scrollToBottom])

  useEffect(() => {
    if (containerMounted && messages.length > 0 && !isLoadingHistory) {
      const timer = setTimeout(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [containerMounted, messages.length, isLoadingHistory, virtualizer])

  const finalizeStreaming = useCallback(() => {
    const parts = [...streamingPartsRef.current]

    if (parts.length > 0) {
      const textContent = parts
        .filter(p => p.type === 'text')
        .map(p => p.content)
        .join('')

      setMessages(prev => [...prev, {
        type: 'assistant',
        content: textContent || '(No text response)',
        timestamp: new Date().toISOString(),
        parts,
        turnId: turnIdRef.current,
      }])
    }

    streamingPartsRef.current = []
    setStreamingParts([])
    setIsStreaming(false)
    currentMessageIdRef.current = undefined
  }, [])

  const connect = useCallback(() => {
    const wsUrl = getChatUrl(workspaceName, agentType)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      const connectMsg: Record<string, unknown> = {
        type: 'connect',
        agentType: agentType === 'opencode' ? 'opencode' : 'claude',
      }
      if (sessionIdRef.current) {
        // Send as sessionId for session manager lookup
        connectMsg.sessionId = sessionIdRef.current
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
        const msg: RawMessage & { sessionId?: string; status?: string; agentSessionId?: string } = JSON.parse(event.data)

        if (msg.type === 'connected') {
          return
        }

        if (msg.type === 'session_started' || msg.type === 'session_joined') {
          if (msg.sessionId) {
            setSessionId(msg.sessionId)
            if (!initialSessionId) {
              hasLoadedHistoryRef.current = true
            }
            onSessionIdRef.current?.(msg.sessionId)
          }
          // If rejoining a running session, show streaming indicator
          if (msg.type === 'session_joined' && msg.status === 'running') {
            setIsStreaming(true)
            // Trigger re-render with any accumulated streaming parts
            setStreamingParts([...streamingPartsRef.current])
          }
          return
        }

        // Handle replayed user messages from server (on reconnect)
        // Use messageId for deduplication when available, fall back to content comparison
        if (msg.type === 'user') {
          const dedupKey = msg.messageId
            ? `user:${msg.messageId}`
            : `user:${msg.timestamp}:${msg.content}`
          if (seenMessageChunksRef.current.has(dedupKey)) {
            return
          }
          seenMessageChunksRef.current.add(dedupKey)
          setMessages(prev => {
            // Also check against existing messages in case it was added locally
            const lastUserMsg = [...prev].reverse().find(m => m.type === 'user')
            if (lastUserMsg && lastUserMsg.content === msg.content) {
              return prev
            }
            return [...prev, {
              type: 'user',
              content: msg.content,
              timestamp: msg.timestamp,
            }]
          })
          return
        }

        if (msg.type === 'tool_use') {
          // Track messageId for this streaming turn
          if (msg.messageId) {
            currentMessageIdRef.current = msg.messageId
          }
          // Deduplicate tool_use by toolId (more reliable than messageId for tools)
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
          // Track messageId for this streaming turn
          if (msg.messageId) {
            currentMessageIdRef.current = msg.messageId
          }
          // Deduplicate tool_result by toolId
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
          // Track messageId for this streaming turn
          if (msg.messageId) {
            currentMessageIdRef.current = msg.messageId
          }

          if (streamingPartsRef.current.length === 0) {
            streamingPartsRef.current.push({ type: 'text', content: '', messageId: msg.messageId })
          }
          const lastPart = streamingPartsRef.current[streamingPartsRef.current.length - 1]
          if (lastPart?.type === 'text') {
            lastPart.content += msg.content
            if (msg.messageId) lastPart.messageId = msg.messageId
          } else {
            streamingPartsRef.current.push({ type: 'text', content: msg.content, messageId: msg.messageId })
          }
          setStreamingParts([...streamingPartsRef.current])
          return
        }

        if (msg.type === 'done') {
          finalizeStreaming()
          return
        }

        if (msg.type === 'system') {
          if (msg.content.startsWith('Session started') || msg.content.startsWith('Connected to session')) {
            return
          }
          if (msg.content === 'Processing your message...') {
            return
          }
        }

        if (msg.type === 'error') {
          setMessages(prev => [...prev, {
            type: 'error',
            content: msg.content,
            timestamp: msg.timestamp,
          }])
          return
        }

        if (msg.type === 'system') {
          try {
            const parsed = JSON.parse(msg.content)
            if (parsed?.agentSessionId) {
              return
            }
          } catch {}
          setMessages(prev => [...prev, {
            type: 'system',
            content: msg.content,
            timestamp: msg.timestamp,
          }])
        }
      } catch (err) {
        console.error('Failed to parse message:', err)
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      finalizeStreaming()
    }

    ws.onerror = (error) => {
      console.error('Chat WebSocket error:', error)
      // Only show error if connection is actually closed/closing, not during transient issues
      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        setMessages(prev => [...prev, {
          type: 'error',
          content: 'Connection error - is the workspace running?',
          timestamp: new Date().toISOString(),
        }])
      }
    }

    return ws
  }, [workspaceName, agentType, finalizeStreaming, projectPath, selectedModel])

  useEffect(() => {
    // Wait for model to be loaded before connecting to ensure the correct model is sent
    if (!modelLoaded) return

    const ws = connect()

    return () => {
      ws.close()
    }
  }, [connect, modelLoaded])

  useEffect(() => {
    onConnectionChange?.(isConnected)
  }, [isConnected, onConnectionChange])

  const sendMessage = useCallback(() => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }

    turnIdRef.current += 1

    const userMessage: ChatMessage = {
      type: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      turnId: turnIdRef.current,
    }

    setMessages(prev => [...prev, userMessage])

    const messagePayload: Record<string, unknown> = {
      type: 'message',
      content: input.trim(),
      model: selectedModelRef.current,
    }

    wsRef.current.send(JSON.stringify(messagePayload))

    setInput('')
    setIsStreaming(true)
    streamingPartsRef.current = []
    setStreamingParts([])
  }, [input])

  const interrupt = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }))
    }
  }, [])

  const handleModelChange = useCallback((newModel: string) => {
    setSelectedModel(newModel)

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_model', model: newModel }))
    }

    const modelInfo = availableModels.find(m => m.id === newModel)
    const displayName = modelInfo?.provider ? `${modelInfo.provider}/${modelInfo.name}` : (modelInfo?.name || newModel)
    setMessages(prev => [...prev, {
      type: 'system',
      content: `Switching to model: ${displayName}`,
      timestamp: new Date().toISOString(),
    }])
  }, [availableModels])


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {agentType === 'opencode' ? (
              <Code2 className="h-5 w-5 text-blue-500" />
            ) : (
              <Bot className="h-5 w-5 text-orange-500" />
            )}
            <span className="font-medium">
              {agentType === 'opencode' ? 'OpenCode' : 'Claude Code'}
            </span>
            {sessionId && (
              <span className="text-xs text-muted-foreground font-mono">
                {sessionId.slice(0, 8)}...
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {availableModels.length > 0 && (
              <Select
                value={selectedModel}
                onValueChange={handleModelChange}
                disabled={isStreaming}
              >
                <SelectTrigger className="h-7 w-[140px] text-xs">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                    {availableModels.map((model) => (
                     <SelectItem key={model.id} value={model.id} className="text-xs">
                       {model.provider ? `${model.provider}/${model.name}` : model.name}
                     </SelectItem>
                   ))}

                </SelectContent>
              </Select>
            )}
            {isConnected ? (
              <span className="flex items-center gap-1 text-xs text-success">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                Disconnected
              </span>
            )}
          </div>
        </div>
      )}

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {isLoadingHistory && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-center">Loading conversation history...</p>
          </div>
        )}

        {messages.length === 0 && !isLoadingHistory && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <Sparkles className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-center">
              Start a conversation with {agentType === 'opencode' ? 'OpenCode' : 'Claude Code'}
            </p>
            <p className="text-sm text-center mt-1">
              Ask questions, request code changes, or get help with your project
            </p>
          </div>
        )}

        {messages.length > 0 && containerMounted && (
          <>
            {isLoadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {hasMoreMessages && !isLoadingMore && (
              <div className="flex justify-center py-2">
                <button
                  onClick={loadMoreMessages}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Load older messages
                </button>
              </div>
            )}
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const message = messages[virtualRow.index]
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="p-4 pb-0"
                  >
                    <MessageBubble message={message} />
                  </div>
                )
              })}
            </div>
          </>
        )}

        {messages.length > 0 && !containerMounted && (
          <div className="space-y-4 p-4">
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}
          </div>
        )}

        {isStreaming && messages.length > 0 && (
          <div className="p-4 pt-0">
            <StreamingMessage parts={streamingParts} />
          </div>
        )}
      </div>

      <div className="border-t p-4 pb-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            className="min-h-[44px] max-h-[200px] resize-none"
            disabled={!isConnected}
            rows={1}
          />
          {isStreaming ? (
            <Button
              onClick={interrupt}
              variant="destructive"
              size="icon"
              className="shrink-0"
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || !isConnected}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
