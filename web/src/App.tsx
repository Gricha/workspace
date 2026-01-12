import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { WorkspaceList } from './pages/WorkspaceList'
import { WorkspaceDetail } from './pages/WorkspaceDetail'
import { EnvironmentSettings } from './pages/settings/Environment'
import { FilesSettings } from './pages/settings/Files'
import { ScriptsSettings } from './pages/settings/Scripts'
import { AgentsSettings } from './pages/settings/Agents'
import { SSHSettings } from './pages/settings/SSH'
import { TerminalSettings } from './pages/settings/Terminal'
import { Setup } from './pages/Setup'
import { Layout } from './components/Layout'
import { SyncProvider } from './contexts/SyncContext'
import { api } from './lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchInterval: 10000,
    },
  },
})

function SessionsRedirect() {
  const { name } = useParams()
  return <Navigate to={`/workspaces/${name}?tab=sessions`} replace />
}

function SetupGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [checked, setChecked] = useState(false)

  const { data: workspaces, isLoading: workspacesLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.listWorkspaces,
  })

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  })

  const isLoading = workspacesLoading || agentsLoading

  useEffect(() => {
    if (isLoading || checked) return

    const hasWorkspaces = workspaces && workspaces.length > 0
    const hasClaudeCode = !!agents?.claude_code?.oauth_token
    const hasOpencode = !!agents?.opencode?.zen_token
    const hasAgents = hasClaudeCode || hasOpencode

    const isUnconfigured = !hasWorkspaces && !hasAgents
    const isOnSetupPage = location.pathname === '/setup'

    if (isUnconfigured && !isOnSetupPage) {
      navigate('/setup', { replace: true })
    }

    setChecked(true)
  }, [workspaces, agents, isLoading, checked, navigate, location.pathname])

  if (!checked && isLoading) {
    return null
  }

  return <>{children}</>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <BrowserRouter>
          <SetupGuard>
            <Routes>
              <Route path="/setup" element={<Setup />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/workspaces" replace />} />
                <Route path="workspaces" element={<WorkspaceList />} />
                <Route path="workspaces/:name" element={<WorkspaceDetail />} />
                <Route path="workspaces/:name/sessions" element={<SessionsRedirect />} />
                <Route path="settings" element={<Navigate to="/settings/environment" replace />} />
                <Route path="settings/environment" element={<EnvironmentSettings />} />
                <Route path="settings/files" element={<FilesSettings />} />
                <Route path="settings/scripts" element={<ScriptsSettings />} />
                <Route path="settings/agents" element={<AgentsSettings />} />
                <Route path="settings/ssh" element={<SSHSettings />} />
                <Route path="settings/terminal" element={<TerminalSettings />} />
              </Route>
            </Routes>
          </SetupGuard>
        </BrowserRouter>
      </SyncProvider>
    </QueryClientProvider>
  )
}

export default App
