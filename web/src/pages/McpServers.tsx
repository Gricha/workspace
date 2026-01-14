import { useEffect, useState } from 'react';
import type React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import type { McpServer } from '@shared/client-types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { KeyValueEditor } from '@/components/KeyValueEditor';

function newServer(): McpServer {
  const id = `mcp_${Math.random().toString(16).slice(2)}`;
  return {
    id,
    name: 'my-mcp',
    enabled: true,
    type: 'local',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    env: {},
  };
}

export function McpServers() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mcp'],
    queryFn: api.getMcpServers,
  });

  const [drafts, setDrafts] = useState<McpServer[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data && !initialized) {
      setDrafts(data);
      setInitialized(true);
    }
  }, [data, initialized]);

  const mutation = useMutation({
    mutationFn: (servers: McpServer[]) => api.updateMcpServers(servers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp'] });
      setHasChanges(false);
    },
  });

  const setServer = (index: number, next: McpServer) => {
    const updated = [...drafts];
    updated[index] = next;
    setDrafts(updated);
    setHasChanges(true);
  };

  const removeServer = (index: number) => {
    setDrafts(drafts.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const addServer = () => {
    setDrafts([...drafts, newServer()]);
    setHasChanges(true);
  };

  const handleSave = () => {
    mutation.mutate(drafts);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-destructive mb-4 text-center">
          <p className="font-medium">Failed to load MCP servers</p>
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
          <h1 className="page-title">MCP Servers</h1>
          <p className="page-description">Synced into Claude Code and OpenCode configs</p>
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-secondary rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">MCP Servers</h1>
        <p className="page-description">Synced into Claude Code and OpenCode configs</p>
      </div>

      <div className="flex items-center justify-between">
        <Button onClick={addServer} variant="outline" size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add MCP Server
        </Button>

        <Button onClick={handleSave} disabled={mutation.isPending || !hasChanges} size="sm">
          <Save className="mr-1.5 h-3.5 w-3.5" />
          Save
        </Button>
      </div>

      {drafts.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">No MCP servers configured</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Click “Add MCP Server” to create one
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((server, index) => (
            <div key={server.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={server.name}
                      onChange={(e) => setServer(index, { ...server, name: e.target.value })}
                      className="font-mono"
                      placeholder="server-name"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeServer(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={server.enabled}
                      onCheckedChange={(checked) =>
                        setServer(index, { ...server, enabled: checked })
                      }
                    />
                    <span className="text-sm text-muted-foreground">Enabled</span>
                    <span className="text-xs text-muted-foreground/60 font-mono">{server.id}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={server.type === 'local' ? 'default' : 'outline'}
                        onClick={() =>
                          setServer(index, {
                            ...server,
                            type: 'local',
                            url: undefined,
                            headers: undefined,
                            oauth: undefined,
                            command: server.command || 'npx',
                            args: server.args || ['-y', '@modelcontextprotocol/server-everything'],
                          })
                        }
                      >
                        Local
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={server.type === 'remote' ? 'default' : 'outline'}
                        onClick={() =>
                          setServer(index, {
                            ...server,
                            type: 'remote',
                            command: undefined,
                            args: undefined,
                            env: undefined,
                            url: server.url || 'https://example.com/mcp',
                            headers: server.headers || {},
                          })
                        }
                      >
                        Remote
                      </Button>
                    </div>

                    {server.type === 'remote' ? (
                      <>
                        <Input
                          value={server.url || ''}
                          placeholder="https://.../mcp"
                          onChange={(e) => setServer(index, { ...server, url: e.target.value })}
                          className="font-mono"
                        />

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setServer(index, {
                                ...server,
                                headers: {
                                  ...(server.headers || {}),
                                  Authorization: 'Bearer {env:API_KEY}',
                                },
                                oauth: false,
                              })
                            }
                          >
                            Add Bearer header
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setServer(index, { ...server, oauth: {} })}
                          >
                            Enable OAuth (auto)
                          </Button>
                        </div>

                        <div className="text-sm font-medium">Headers</div>
                        <KeyValueEditor
                          value={server.headers}
                          onChange={(headers) => setServer(index, { ...server, headers })}
                          emptyLabel="No headers configured"
                        />

                        <div className="text-sm font-medium">OAuth (OpenCode)</div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={server.oauth === undefined ? 'default' : 'outline'}
                            onClick={() => setServer(index, { ...server, oauth: undefined })}
                          >
                            Auto
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={server.oauth === false ? 'default' : 'outline'}
                            onClick={() => setServer(index, { ...server, oauth: false })}
                          >
                            Disabled
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              server.oauth && server.oauth.clientId !== undefined
                                ? 'default'
                                : server.oauth && server.oauth.clientSecret !== undefined
                                  ? 'default'
                                  : 'outline'
                            }
                            onClick={() =>
                              setServer(index, {
                                ...server,
                                oauth: server.oauth
                                  ? server.oauth
                                  : {
                                      clientId: '{env:MCP_CLIENT_ID}',
                                      clientSecret: '{env:MCP_CLIENT_SECRET}',
                                    },
                              })
                            }
                          >
                            Pre-registered
                          </Button>
                        </div>

                        {server.oauth !== undefined && server.oauth !== false ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              value={server.oauth.clientId || ''}
                              placeholder="clientId"
                              className="font-mono"
                              onChange={(e) =>
                                setServer(index, {
                                  ...server,
                                  oauth: { ...server.oauth, clientId: e.target.value || undefined },
                                })
                              }
                            />
                            <Input
                              value={server.oauth.clientSecret || ''}
                              placeholder="clientSecret"
                              className="font-mono"
                              onChange={(e) =>
                                setServer(index, {
                                  ...server,
                                  oauth: {
                                    ...server.oauth,
                                    clientSecret: e.target.value || undefined,
                                  },
                                })
                              }
                            />
                            <Input
                              value={server.oauth.scope || ''}
                              placeholder="scope"
                              className="font-mono sm:col-span-2"
                              onChange={(e) =>
                                setServer(index, {
                                  ...server,
                                  oauth: { ...server.oauth, scope: e.target.value || undefined },
                                })
                              }
                            />
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            value={server.command || ''}
                            placeholder="command"
                            onChange={(e) =>
                              setServer(index, { ...server, command: e.target.value || undefined })
                            }
                            className="font-mono"
                          />
                          <Textarea
                            value={JSON.stringify(server.args || [], null, 2)}
                            placeholder='["-y", "@modelcontextprotocol/server-everything"]'
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                              try {
                                const parsed = JSON.parse(e.target.value) as unknown;
                                setServer(index, {
                                  ...server,
                                  args: Array.isArray(parsed)
                                    ? parsed.filter((v): v is string => typeof v === 'string')
                                    : server.args,
                                });
                              } catch {
                                // ignore parse errors
                              }
                            }}
                            className="font-mono"
                            rows={4}
                          />
                        </div>

                        <div className="text-sm font-medium">Environment</div>
                        <KeyValueEditor
                          value={server.env}
                          onChange={(env) => setServer(index, { ...server, env })}
                          emptyLabel="No environment variables"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {mutation.error && (
        <div className="mt-4 rounded border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
        </div>
      )}
    </div>
  );
}

export default McpServers;
