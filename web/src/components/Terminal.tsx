import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { getTerminalUrl } from '@/lib/api'

interface TerminalProps {
  workspaceName: string
  initialCommand?: string
}

export function Terminal({ workspaceName, initialCommand }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const initialCommandSent = useRef(false)

  const connect = useCallback(() => {
    if (!terminalRef.current) return

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        selectionBackground: '#264f78',
      },
    })
    xtermRef.current = xterm

    const fitAddon = new FitAddon()
    fitAddonRef.current = fitAddon
    xterm.loadAddon(fitAddon)

    xterm.open(terminalRef.current)
    fitAddon.fit()

    const wsUrl = getTerminalUrl(workspaceName)

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[terminal] WebSocket opened to:', wsUrl)
      xterm.writeln('\x1b[32mConnected to workspace terminal\x1b[0m')
      xterm.writeln('')
      const { cols, rows } = xterm
      console.log('[terminal] sending resize:', cols, rows)
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))

      if (initialCommand && !initialCommandSent.current) {
        initialCommandSent.current = true
        setTimeout(() => {
          ws.send(initialCommand + '\n')
        }, 300)
      }
    }

    ws.onmessage = (event) => {
      console.log('[terminal] received:', typeof event.data, event.data.length || event.data.byteLength)
      if (event.data instanceof Blob) {
        event.data.text().then((text) => {
          xterm.write(text)
        })
      } else if (event.data instanceof ArrayBuffer) {
        xterm.write(new Uint8Array(event.data))
      } else {
        xterm.write(event.data)
      }
    }

    ws.onclose = (event) => {
      xterm.writeln('')
      if (event.code === 1000) {
        xterm.writeln('\x1b[33mSession ended\x1b[0m')
      } else if (event.code === 404 || event.reason?.includes('not found')) {
        xterm.writeln('\x1b[31mWorkspace not found or not running\x1b[0m')
      } else {
        xterm.writeln(`\x1b[31mDisconnected (code: ${event.code})\x1b[0m`)
      }
    }

    ws.onerror = (error) => {
      console.error('Terminal WebSocket error:', error)
      xterm.writeln('\x1b[31mConnection error - is the workspace running?\x1b[0m')
    }

    xterm.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    xterm.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })
  }, [workspaceName, initialCommand])

  useEffect(() => {
    connect()

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (xtermRef.current) {
        xtermRef.current.dispose()
      }
    }
  }, [connect])

  return (
    <div
      ref={terminalRef}
      className="h-full w-full min-h-[400px] bg-[#1e1e1e] rounded-lg overflow-hidden"
    />
  )
}
