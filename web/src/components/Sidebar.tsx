import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Menu,
  X,
  KeyRound,
  FolderSync,
  Terminal,
  Settings,
  Monitor,
  Boxes,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, type WorkspaceInfo } from '@/lib/api'
import { HOST_WORKSPACE_NAME } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'

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

  const { data: hostInfo } = useQuery({
    queryKey: ['hostInfo'],
    queryFn: api.getHostInfo,
  })

  const settingsLinks = [
    { to: '/settings/environment', label: 'Environment', icon: KeyRound },
    { to: '/settings/agents', label: 'Configuration', icon: Settings },
    { to: '/settings/files', label: 'Files', icon: FolderSync },
    { to: '/settings/scripts', label: 'Scripts', icon: Terminal },
    { to: '/settings/ssh', label: 'SSH Keys', icon: KeyRound },
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
            <img src="/logo.png" alt="Perry Logo" className="h-7 w-7 object-contain" />
            <span className="font-semibold text-sm tracking-tight">Perry</span>
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
                    'flex items-center gap-2.5 rounded px-2 py-2 text-sm transition-colors hover:bg-accent min-h-[44px]',
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
                      'flex items-center gap-2.5 rounded px-2 py-2 text-sm transition-colors hover:bg-accent group min-h-[44px]',
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
                {hostInfo?.enabled && (
                  <Link
                    to={`/workspaces/${encodeURIComponent(HOST_WORKSPACE_NAME)}`}
                    className={cn(
                      'flex items-center gap-2.5 rounded px-2 py-2 text-sm transition-colors hover:bg-accent group min-h-[44px]',
                      location.pathname.includes(encodeURIComponent(HOST_WORKSPACE_NAME)) && 'nav-active'
                    )}
                    onClick={() => isOpen && onToggle()}
                  >
                    <Monitor className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors">
                      {hostInfo.hostname}
                    </span>
                  </Link>
                )}
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
                      'flex items-center gap-2.5 rounded px-2 py-2 text-sm transition-colors hover:bg-accent min-h-[44px]',
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

        <div className="border-t p-3 flex-shrink-0 space-y-2">
          <div className="section-header">Appearance</div>
          <ThemeSwitcher />
          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider pt-2">
            Perry v0.1.0
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
