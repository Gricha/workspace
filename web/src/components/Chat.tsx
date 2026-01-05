import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, StopCircle, Bot, Sparkles, Wrench, ChevronDown, CheckCircle2, Loader2, Code2 } from 'lucide-react'
import Markdown from 'react-markdown'
import { useVirtualizer } from '@tanstack/react-virtual'
import { getChatUrl, api, type AgentType } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ChatMessagePart {
  type: 'text' | 'tool_use' | 'tool_result'
  content: string
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
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result' | 'error' | 'done' | 'connected'
  content: string
  timestamp: string
  toolName?: string
  toolId?: string
}

interface ChatProps {
  workspaceName: string
  sessionId?: string
  onSessionId?: (sessionId: string) => void
  agentType?: AgentType
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
    <div className="ml-0">
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
  const hasContent = parts.some(p => p.content.length > 0)

  return (
    <div className="space-y-3">
      {renderPartsWithPairedTools(parts)}
      {!hasContent && (
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  )
}

export function Chat({ workspaceName, sessionId: initialSessionId, onSessionId, agentType = 'claude-code' }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(!!initialSessionId)
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)

  useEffect(() => {
    if (!initialSessionId || !workspaceName) return

    setIsLoadingHistory(true)
    api.getSession(workspaceName, initialSessionId, agentType)
      .then((detail) => {
        if (detail?.messages) {
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

          for (const m of detail.messages) {
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

          setMessages(historicalMessages)
        }
      })
      .catch((err) => {
        console.error('Failed to load session history:', err)
      })
      .finally(() => {
        setIsLoadingHistory(false)
      })
  }, [initialSessionId, workspaceName, agentType])

  const streamingPartsRef = useRef<ChatMessagePart[]>([])
  const [streamingParts, setStreamingParts] = useState<ChatMessagePart[]>([])
  const turnIdRef = useRef(0)

  const wsRef = useRef<WebSocket | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const shouldAutoScrollRef = useRef(true)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 80,
    overscan: 5,
    getItemKey: (index) => `msg-${index}-${messages[index]?.turnId ?? index}`,
  })

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current && shouldAutoScrollRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      shouldAutoScrollRef.current = isNearBottom
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingParts, scrollToBottom])

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
  }, [])

  const connect = useCallback(() => {
    const wsUrl = getChatUrl(workspaceName, agentType)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const msg: RawMessage = JSON.parse(event.data)

        if (msg.type === 'connected') {
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
            lastPart.content += msg.content
          } else {
            streamingPartsRef.current.push({ type: 'text', content: msg.content })
          }
          setStreamingParts([...streamingPartsRef.current])
          return
        }

        if (msg.type === 'done') {
          finalizeStreaming()
          return
        }

        if (msg.type === 'system') {
          if (msg.content.startsWith('Session started')) {
            const match = msg.content.match(/Session (\S+)/)
            if (match) {
              const newSessionId = match[1]
              setSessionId(newSessionId)
              onSessionId?.(newSessionId)
            }
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
      setMessages(prev => [...prev, {
        type: 'error',
        content: 'Connection error - is the workspace running?',
        timestamp: new Date().toISOString(),
      }])
    }

    return ws
  }, [workspaceName, agentType, onSessionId, finalizeStreaming])

  useEffect(() => {
    const ws = connect()

    return () => {
      ws.close()
    }
  }, [connect])

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

    wsRef.current.send(JSON.stringify({
      type: 'message',
      content: input.trim(),
      sessionId,
    }))

    setInput('')
    setIsStreaming(true)
    streamingPartsRef.current = []
    setStreamingParts([])
  }, [input, sessionId])

  const interrupt = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }))
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-2">
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

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {isLoadingHistory && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-center">Loading conversation history...</p>
          </div>
        )}

        {!isLoadingHistory && messages.length === 0 && !isStreaming && (
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

        {!isLoadingHistory && messages.length > 0 && (
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
        )}

        {isStreaming && (
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
