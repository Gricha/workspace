import { useEffect, useRef, useCallback, useState } from 'react'
import { init, Terminal as GhosttyTerminal, FitAddon } from 'ghostty-web'
import { getTerminalUrl } from '@/lib/api'

interface TerminalProps {
  workspaceName: string
  initialCommand?: string
}

let ghosttyInitialized = false
let ghosttyInitPromise: Promise<void> | null = null

async function ensureGhosttyInit(): Promise<void> {
  if (ghosttyInitialized) return
  if (ghosttyInitPromise) return ghosttyInitPromise

  ghosttyInitPromise = init().then(() => {
    ghosttyInitialized = true
  })
  return ghosttyInitPromise
}

export function Terminal({ workspaceName, initialCommand }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<GhosttyTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const initialCommandSent = useRef(false)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  const connect = useCallback(async () => {
    if (!terminalRef.current) return

    await ensureGhosttyInit()
    setIsInitialized(true)

    const term = new GhosttyTerminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      scrollback: 10000,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        selectionForeground: '#ffffff',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
    })
    termRef.current = term

    const fitAddon = new FitAddon()
    fitAddonRef.current = fitAddon
    term.loadAddon(fitAddon)

    term.open(terminalRef.current)

    requestAnimationFrame(() => {
      fitAddon.fit()
    })

    const wsUrl = getTerminalUrl(workspaceName)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      term.writeln('\x1b[38;5;245mConnecting to workspace...\x1b[0m')
      const { cols, rows } = term
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))

      if (initialCommand && !initialCommandSent.current) {
        initialCommandSent.current = true
        setTimeout(() => {
          ws.send(initialCommand + '\n')
        }, 500)
      }
    }

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        event.data.text().then((text) => {
          term.write(text)
        })
      } else if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data))
      } else {
        term.write(event.data)
      }
    }

    ws.onclose = (event) => {
      setIsConnected(false)
      term.writeln('')
      if (event.code === 1000) {
        term.writeln('\x1b[38;5;245mSession ended\x1b[0m')
      } else if (event.code === 404 || event.reason?.includes('not found')) {
        term.writeln('\x1b[31mWorkspace not found or not running\x1b[0m')
      } else {
        term.writeln(`\x1b[31mDisconnected (code: ${event.code})\x1b[0m`)
      }
    }

    ws.onerror = () => {
      setIsConnected(false)
      term.writeln('\x1b[31mConnection error - is the workspace running?\x1b[0m')
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })

    term.focus()
  }, [workspaceName, initialCommand])

  useEffect(() => {
    connect()

    const handleFit = () => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit()
        } catch {
        }
      }
    }

    const debouncedFit = debounce(handleFit, 100)

    if (terminalRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        debouncedFit()
      })
      resizeObserverRef.current.observe(terminalRef.current)
    }

    window.addEventListener('resize', debouncedFit)

    return () => {
      window.removeEventListener('resize', debouncedFit)
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (termRef.current) {
        termRef.current.dispose()
      }
    }
  }, [connect])

  return (
    <div className="relative flex flex-col h-full w-full min-h-[500px]">
      <div
        ref={terminalRef}
        className="flex-1 w-full bg-[#0d1117] rounded-lg overflow-hidden"
        style={{
          padding: '12px',
          minHeight: '500px',
        }}
        onClick={() => termRef.current?.focus()}
      />
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117] rounded-lg">
          <span className="text-muted-foreground text-sm">Loading terminal...</span>
        </div>
      )}
      {isInitialized && !isConnected && (
        <div className="absolute bottom-3 right-3">
          <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Disconnected
          </span>
        </div>
      )}
    </div>
  )
}

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), ms)
  }) as T
}
