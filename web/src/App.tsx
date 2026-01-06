import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WorkspaceList } from './pages/WorkspaceList'
import { WorkspaceDetail } from './pages/WorkspaceDetail'
import { EnvironmentSettings } from './pages/settings/Environment'
import { FilesSettings } from './pages/settings/Files'
import { ScriptsSettings } from './pages/settings/Scripts'
import { AgentsSettings } from './pages/settings/Agents'
import { SSHSettings } from './pages/settings/SSH'
import { Layout } from './components/Layout'
import { SyncProvider } from './contexts/SyncContext'

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <BrowserRouter>
          <Routes>
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
            </Route>
          </Routes>
        </BrowserRouter>
      </SyncProvider>
    </QueryClientProvider>
  )
}

export default App
