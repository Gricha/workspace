import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar, SidebarTrigger } from './Sidebar'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-4 lg:hidden">
          <SidebarTrigger onClick={() => setSidebarOpen(true)} />
          <span className="ml-3 font-semibold">Workspace</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
