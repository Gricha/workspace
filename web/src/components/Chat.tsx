import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, StopCircle, Bot, User, Sparkles, Wrench, ChevronDown, ChevronRight } from 'lucide-react'
import Markdown from 'react-markdown'
import { getChatUrl } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ToolCall {
  toolName: string
  toolId: string
  content: string
}

interface ChatMessage {
  type: 'user' | 'assistant' | 'system' | 'error'
  content: string
  timestamp: string
  toolCalls?: ToolCall[]
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
}

function ToolCallsSection({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false)

  if (toolCalls.length === 0) return null

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Wrench className="h-3 w-3" />
        <span>{toolCalls.length} tool call{toolCalls.length > 1 ? 's' : ''}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 pl-4 border-l-2 border-amber-500/20">
          {toolCalls.map((tool, idx) => (
            <div key={idx} className="text-xs">
              <span className="font-mono font-medium text-amber-600">{tool.toolName}</span>
              {tool.content && (
                <pre className="mt-1 p-2 bg-muted/50 rounded text-xs overflow-x-auto max-h-24 overflow-y-auto border border-border/50">
                  {tool.content.slice(0, 300)}
                  {tool.content.length > 300 && '...'}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
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

  const isUser = message.type === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary/10 text-primary'
            : 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-600'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted/50 border border-border/50 rounded-tl-sm'
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <ToolCallsSection toolCalls={message.toolCalls} />
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-pre:bg-background/50 prose-pre:border prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
              <Markdown>{message.content}</Markdown>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StreamingMessage({ content, toolCalls }: { content: string; toolCalls: ToolCall[] }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-violet-600">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="max-w-[85%] bg-muted/50 border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3">
        {toolCalls.length > 0 && <ToolCallsSection toolCalls={toolCalls} />}
        {content ? (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-pre:bg-background/50 prose-pre:border prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
            <Markdown>{content}</Markdown>
          </div>
        ) : (
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  )
}

export function Chat({ workspaceName, sessionId: initialSessionId, onSessionId }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)

  const streamingContentRef = useRef('')
  const streamingToolCallsRef = useRef<ToolCall[]>([])
  const [streamingState, setStreamingState] = useState({ content: '', toolCalls: [] as ToolCall[] })

  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingState, scrollToBottom])

  const finalizeStreaming = useCallback(() => {
    const content = streamingContentRef.current
    const toolCalls = [...streamingToolCallsRef.current]

    if (content || toolCalls.length > 0) {
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: content || '(No text response)',
        timestamp: new Date().toISOString(),
        toolCalls,
      }])
    }

    streamingContentRef.current = ''
    streamingToolCallsRef.current = []
    setStreamingState({ content: '', toolCalls: [] })
    setIsStreaming(false)
  }, [])

  const connect = useCallback(() => {
    const wsUrl = getChatUrl(workspaceName)
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
          const toolCall: ToolCall = {
            toolName: msg.toolName || 'unknown',
            toolId: msg.toolId || '',
            content: msg.content,
          }
          streamingToolCallsRef.current = [...streamingToolCallsRef.current, toolCall]
          setStreamingState(prev => ({
            ...prev,
            toolCalls: [...streamingToolCallsRef.current],
          }))
          return
        }

        if (msg.type === 'assistant') {
          streamingContentRef.current += msg.content
          setStreamingState(prev => ({
            ...prev,
            content: streamingContentRef.current,
          }))
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
  }, [workspaceName, onSessionId, finalizeStreaming])

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

    const userMessage: ChatMessage = {
      type: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])

    wsRef.current.send(JSON.stringify({
      type: 'message',
      content: input.trim(),
      sessionId,
    }))

    setInput('')
    setIsStreaming(true)
    streamingContentRef.current = ''
    streamingToolCallsRef.current = []
    setStreamingState({ content: '', toolCalls: [] })
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
          <Bot className="h-5 w-5 text-orange-500" />
          <span className="font-medium">Claude Code</span>
          {sessionId && (
            <span className="text-xs text-muted-foreground font-mono">
              {sessionId.slice(0, 8)}...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Sparkles className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-center">
              Start a conversation with Claude Code
            </p>
            <p className="text-sm text-center mt-1">
              Ask questions, request code changes, or get help with your project
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}

        {isStreaming && (
          <StreamingMessage
            content={streamingState.content}
            toolCalls={streamingState.toolCalls}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4">
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
