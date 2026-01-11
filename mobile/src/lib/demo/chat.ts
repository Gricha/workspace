import type { AgentType } from '../api'

type MessageEvent = { data: string }

type DemoChatWebSocketOptions = {
  workspaceName: string
  agentType: AgentType
}

type ClientMessage =
  | { type: 'connect'; agentType?: string; sessionId?: string; model?: string; projectPath?: string }
  | { type: 'message'; content?: string }
  | { type: 'interrupt' }

function safeJsonParse(input: unknown): unknown {
  if (typeof input !== 'string') return null
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

export class DemoChatWebSocket {
  // WebSocket-compatible fields used by SessionChatScreen
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  readyState: number

  private timers: Array<ReturnType<typeof setTimeout>> = []
  private connected = false
  private sessionId = `demo-live-${Math.random().toString(16).slice(2)}`
  private agentSessionId = `demo-session-${Math.random().toString(16).slice(2)}`

  constructor(private options: DemoChatWebSocketOptions) {
    // Mirror React Native WebSocket constants.
    this.readyState = typeof WebSocket !== 'undefined' ? WebSocket.CONNECTING : 0

    this.queue(() => {
      this.readyState = typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1
      this.connected = true
      this.onopen?.()
    }, 10)
  }

  send(data: string): void {
    const parsed = safeJsonParse(data)
    if (!parsed || typeof parsed !== 'object') return

    const msg = parsed as ClientMessage

    if (msg.type === 'connect') {
      this.emit({ type: 'connected' })
      this.emit({
        type: 'session_started',
        sessionId: this.sessionId,
        agentSessionId: this.agentSessionId,
      })
      return
    }

    if (msg.type === 'interrupt') {
      this.cancelAllTimers()
      this.emit({ type: 'done' })
      return
    }

    if (msg.type === 'message') {
      this.cancelAllTimers()
      this.runDemoScript(msg.content || '')
    }
  }

  close(): void {
    if (!this.connected) return

    this.cancelAllTimers()
    this.connected = false
    this.readyState = typeof WebSocket !== 'undefined' ? WebSocket.CLOSED : 3
    this.onclose?.()
  }

  private emit(payload: Record<string, unknown>): void {
    if (!this.connected) return
    this.onmessage?.({ data: JSON.stringify(payload) })
  }

  private queue(fn: () => void, delayMs: number): void {
    this.timers.push(setTimeout(fn, delayMs))
  }

  private cancelAllTimers(): void {
    this.timers.forEach(t => clearTimeout(t))
    this.timers = []
  }

  private runDemoScript(userMessage: string): void {
    const messageId = `demo-msg-${Date.now()}`

    const chunks: Array<{ delay: number; payload: Record<string, unknown> }> = []

    const toolUse = (toolId: string, toolName: string, content: unknown) =>
      ({ type: 'tool_use', toolId, toolName, content: JSON.stringify(content), messageId })

    const toolResult = (toolId: string, content: unknown) =>
      ({ type: 'tool_result', toolId, content, messageId })

    const assistant = (content: string) => ({ type: 'assistant', content, messageId })

    chunks.push({ delay: 60, payload: assistant("I will help with that. Let me check the project structure first.\n\n") })
    chunks.push({
      delay: 250,
      payload: toolUse('1', 'Glob', { pattern: '**/*.{ts,tsx,js,jsx,json,md}' }),
    })
    chunks.push({
      delay: 450,
      payload: toolResult('1', 'README.md\npackage.json\nsrc/index.ts\nsrc/utils.ts\n'),
    })
    chunks.push({ delay: 650, payload: assistant('I found a few key files. I will read the entry point.\n\n') })
    chunks.push({ delay: 850, payload: toolUse('2', 'Read', { path: 'src/index.ts' }) })
    chunks.push({
      delay: 1050,
      payload: toolResult('2', "export function main() {\n  console.log('Hello from demo');\n}\n"),
    })
    chunks.push({ delay: 1250, payload: assistant(`Based on this, here’s a safe next step: add a small change and validate it.\n\nYou said: ${JSON.stringify(userMessage)}\n`) })
    chunks.push({ delay: 1450, payload: toolUse('3', 'Bash', { command: 'bun test', description: 'Runs unit tests' }) })
    chunks.push({ delay: 1650, payload: toolResult('3', 'All tests passed (demo).') })
    chunks.push({ delay: 1850, payload: assistant('Looks good. Want me to implement the change or explain the structure?') })
    chunks.push({ delay: 1950, payload: { type: 'done' } })

    chunks.forEach(({ delay, payload }) => {
      this.queue(() => this.emit(payload), delay)
    })
  }
}

export function createDemoChatWebSocket(options: DemoChatWebSocketOptions): DemoChatWebSocket {
  return new DemoChatWebSocket(options)
}
