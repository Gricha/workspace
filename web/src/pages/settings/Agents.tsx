import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { api, type CodingAgents } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSyncNotification } from '@/contexts/SyncContext';
import { AgentIcon } from '@/components/AgentIcon';

export function AgentsSettings() {
  const queryClient = useQueryClient();
  const showSyncNotification = useSyncNotification();

  const {
    data: agents,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
  });

  const [opencodeServerHostname, setOpencodeServerHostname] = useState('0.0.0.0');
  const [opencodeServerUsername, setOpencodeServerUsername] = useState('');
  const [opencodeServerPassword, setOpencodeServerPassword] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (agents && !initialized) {
      setOpencodeServerHostname(agents.opencode?.server?.hostname || '0.0.0.0');
      setOpencodeServerUsername(agents.opencode?.server?.username || '');
      setOpencodeServerPassword(agents.opencode?.server?.password || '');
      setInitialized(true);
    }
  }, [agents, initialized]);

  const mutation = useMutation({
    mutationFn: (data: CodingAgents) => api.updateAgents(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setHasChanges(false);
      setSaved(true);
      showSyncNotification();
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSave = useCallback(() => {
    mutation.mutate({
      ...(agents ?? {}),
      opencode: {
        server: {
          hostname: opencodeServerHostname.trim() || undefined,
          username: opencodeServerUsername.trim() || undefined,
          password: opencodeServerPassword || undefined,
        },
      },
    });
  }, [agents, mutation, opencodeServerHostname, opencodeServerUsername, opencodeServerPassword]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-destructive mb-4 text-center">
          <p className="font-medium">Failed to load settings</p>
          <p className="text-sm text-muted-foreground mt-1">Please check your connection</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        <div className="page-header">
          <h1 className="page-title">AI Agents</h1>
          <p className="page-description">Agent credentials are synced from the host</p>
        </div>
        <div className="space-y-4">
          <div className="agent-row animate-pulse">
            <div className="agent-icon bg-secondary" />
            <div className="agent-info space-y-2">
              <div className="h-4 w-32 bg-secondary rounded" />
              <div className="h-3 w-64 bg-secondary rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">AI Agents</h1>
        <p className="page-description">
          Agent credentials are synced from the host. Configure OpenCode server access here.
        </p>
      </div>

      <div className="agent-row">
        <AgentIcon agentType="opencode" size="md" />
        <div className="agent-info">
          <div className="agent-name">OpenCode Server</div>
          <p className="agent-description">
            Control how <code>opencode serve</code> is exposed inside workspaces.
          </p>
          <div className="space-y-2 mt-2">
            <div className="agent-input flex flex-col sm:flex-row gap-2">
              <Input
                value={opencodeServerHostname}
                onChange={(e) => {
                  setOpencodeServerHostname(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="server hostname (0.0.0.0 or 127.0.0.1)"
                className="w-full sm:w-[260px] font-mono text-sm h-11 sm:h-9"
              />
              <Input
                type="password"
                value={opencodeServerUsername}
                onChange={(e) => {
                  setOpencodeServerUsername(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="server username (optional)"
                className="w-full sm:w-[220px] font-mono text-sm h-11 sm:h-9"
              />
              <Input
                type="password"
                value={opencodeServerPassword}
                onChange={(e) => {
                  setOpencodeServerPassword(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="server password (optional)"
                className="w-full sm:w-[220px] font-mono text-sm h-11 sm:h-9"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={mutation.isPending || !hasChanges}
                variant={saved ? 'secondary' : 'default'}
              >
                {saved ? 'Saved' : 'Save'}
              </Button>
              {hasChanges && (
                <span className="text-xs text-muted-foreground">
                  Run <code>perry sync</code> to apply changes
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
