import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Menu,
  X,
  Boxes,
  KeyRound,
  FileKey,
  Terminal,
  Cpu,
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

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.listWorkspaces,
  })

  const settingsLinks = [
    { to: '/settings/environment', label: 'Environment', icon: KeyRound },
    { to: '/settings/agents', label: 'Coding Agents', icon: Cpu },
    { to: '/settings/files', label: 'Credential Files', icon: FileKey },
    { to: '/settings/scripts', label: 'Scripts', icon: Terminal },
  ]

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onToggle}
      />

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-60 flex-col bg-card border-r transition-transform duration-200 ease-out lg:translate-x-0 lg:static lg:z-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15">
              <Boxes className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Command</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={onToggle}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-6">
            {/* Workspaces Section */}
            <div>
              <div className="section-header">Workspaces</div>
              <div className="space-y-0.5">
                <Link
                  to="/workspaces"
                  className={cn(
                    'flex items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                    location.pathname === '/workspaces' && 'nav-active'
                  )}
                  onClick={() => isOpen && onToggle()}
                >
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                  <span>All Workspaces</span>
                </Link>
                {workspaces?.map((ws: WorkspaceInfo) => (
                  <Link
                    key={ws.name}
                    to={`/workspaces/${ws.name}`}
                    className={cn(
                      'flex items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent group',
                      (location.pathname === `/workspaces/${ws.name}` ||
                        location.pathname.startsWith(`/workspaces/${ws.name}/`)) && 'nav-active'
                    )}
                    onClick={() => isOpen && onToggle()}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full flex-shrink-0',
                        ws.status === 'running'
                          ? 'status-online status-online-pulse'
                          : 'bg-muted-foreground/40'
                      )}
                    />
                    <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors">
                      {ws.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Settings Section - Always visible */}
            <div>
              <div className="section-header">Settings</div>
              <div className="space-y-0.5">
                {settingsLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      'flex items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                      location.pathname === link.to && 'nav-active'
                    )}
                    onClick={() => isOpen && onToggle()}
                  >
                    <link.icon className="h-4 w-4 text-muted-foreground" />
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className="border-t p-3 flex-shrink-0">
          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
            Workspace v0.1.0
          </div>
        </div>
      </aside>
    </>
  )
}

export function SidebarTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={onClick}>
      <Menu className="h-5 w-5" />
    </Button>
  )
}
