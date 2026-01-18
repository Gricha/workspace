import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { WorkspaceList } from './pages/WorkspaceList';
import { WorkspaceDetail } from './pages/WorkspaceDetail';
import { EnvironmentSettings } from './pages/settings/Environment';
import { FilesSettings } from './pages/settings/Files';
import { ScriptsSettings } from './pages/settings/Scripts';
import { AgentsSettings } from './pages/settings/Agents';
import { SSHSettings } from './pages/settings/SSH';
import { TerminalSettings } from './pages/settings/Terminal';
import { GitHubSettings } from './pages/settings/GitHub';
import { TailscaleSettings } from './pages/settings/Tailscale';
import { Setup } from './pages/Setup';
import { Skills } from './pages/Skills';
import { McpServers } from './pages/McpServers';
import { Layout } from './components/Layout';
import { SyncProvider } from './contexts/SyncContext';
import { api } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchInterval: 10000,
    },
  },
});

function SessionsRedirect() {
  const { name } = useParams();
  return <Navigate to={`/workspaces/${name}?tab=sessions`} replace />;
}

function SetupGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  const {
    data: workspaces,
    isLoading: workspacesLoading,
    isError: workspacesError,
  } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.listWorkspaces,
  });

  const isLoading = workspacesLoading;
  const hasError = workspacesError;

  useEffect(() => {
    if (isLoading || checked || hasError) return;

    const hasWorkspaces = workspaces && workspaces.length > 0;
    const isUnconfigured = !hasWorkspaces;
    const isOnSetupPage = location.pathname === '/setup';

    if (isUnconfigured && !isOnSetupPage) {
      navigate('/setup', { replace: true });
    }

    setChecked(true);
  }, [workspaces, isLoading, checked, hasError, navigate, location.pathname]);

  if (!checked && isLoading) {
    return null;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <BrowserRouter>
          <SetupGuard>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/workspaces" replace />} />
                <Route path="setup" element={<Setup />} />
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
                <Route path="settings/github" element={<GitHubSettings />} />
                <Route path="settings/tailscale" element={<TailscaleSettings />} />
                <Route path="skills" element={<Skills />} />
                <Route path="mcp" element={<McpServers />} />
              </Route>
            </Routes>
          </SetupGuard>
        </BrowserRouter>
      </SyncProvider>
    </QueryClientProvider>
  );
}

export default App;
