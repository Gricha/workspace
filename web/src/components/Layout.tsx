import { Outlet, Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">Workspace</span>
          </Link>
          <nav className="ml-8 flex items-center space-x-4">
            <Link
              to="/workspaces"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                location.pathname.startsWith('/workspaces')
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              Workspaces
            </Link>
            <Link
              to="/settings"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                location.pathname === '/settings'
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
