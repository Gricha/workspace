import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Menu,
  X,
  Boxes,
  KeyRound,
  FileKey,
  Terminal,
  ChevronDown,
  ChevronRight,
  Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, type WorkspaceInfo } from '@/lib/api'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation()
  const [settingsExpanded, setSettingsExpanded] = useState(
    location.pathname.startsWith('/settings')
  )

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.listWorkspaces,
  })

  const settingsLinks = [
    { to: '/settings/environment', label: 'Environment', icon: KeyRound },
    { to: '/settings/agents', label: 'Coding Agents', icon: Terminal },
    { to: '/settings/files', label: 'Credential Files', icon: FileKey },
    { to: '/settings/scripts', label: 'Scripts', icon: Terminal },
  ]

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 lg:hidden',
          isOpen ? 'block' : 'hidden'
        )}
        onClick={onToggle}
      />

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-64 bg-card border-r transition-transform duration-200 lg:translate-x-0 lg:static lg:z-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link to="/" className="flex items-center space-x-2">
            <Boxes className="h-5 w-5" />
            <span className="font-semibold">Workspace</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onToggle}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            <div>
              <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Workspaces
              </div>
              <div className="space-y-1">
                <Link
                  to="/workspaces"
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent',
                    location.pathname === '/workspaces' && 'bg-accent'
                  )}
                  onClick={() => isOpen && onToggle()}
                >
                  <Boxes className="h-4 w-4" />
                  All Workspaces
                </Link>
                {workspaces?.map((ws: WorkspaceInfo) => (
                  <Link
                    key={ws.name}
                    to={`/workspaces/${ws.name}`}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                      location.pathname === `/workspaces/${ws.name}` && 'bg-accent'
                    )}
                    onClick={() => isOpen && onToggle()}
                  >
                    <Circle
                      className={cn(
                        'h-2 w-2',
                        ws.status === 'running'
                          ? 'fill-green-500 text-green-500'
                          : 'fill-muted-foreground text-muted-foreground'
                      )}
                    />
                    <span className="truncate">{ws.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className="mb-2 flex w-full items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <span>Settings</span>
                {settingsExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
              {settingsExpanded && (
                <div className="space-y-1">
                  {settingsLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                        location.pathname === link.to && 'bg-accent'
                      )}
                      onClick={() => isOpen && onToggle()}
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </nav>
      </aside>
    </>
  )
}

export function SidebarTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClick}>
      <Menu className="h-5 w-5" />
    </Button>
  )
}
