import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WorkspaceList } from './pages/WorkspaceList'
import { WorkspaceDetail } from './pages/WorkspaceDetail'
import { Sessions } from './pages/Sessions'
import { EnvironmentSettings } from './pages/settings/Environment'
import { FilesSettings } from './pages/settings/Files'
import { ScriptsSettings } from './pages/settings/Scripts'
import { AgentsSettings } from './pages/settings/Agents'
import { Layout } from './components/Layout'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchInterval: 10000,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/workspaces" replace />} />
            <Route path="workspaces" element={<WorkspaceList />} />
            <Route path="workspaces/:name" element={<WorkspaceDetail />} />
            <Route path="workspaces/:name/sessions" element={<Sessions />} />
            <Route path="sessions" element={<Navigate to="/workspaces" replace />} />
            <Route path="settings" element={<Navigate to="/settings/environment" replace />} />
            <Route path="settings/environment" element={<EnvironmentSettings />} />
            <Route path="settings/files" element={<FilesSettings />} />
            <Route path="settings/scripts" element={<ScriptsSettings />} />
            <Route path="settings/agents" element={<AgentsSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
