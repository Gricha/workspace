import { os, ORPCError } from '@orpc/server';
import * as z from 'zod';
import os_module from 'os';
import { type AgentConfig } from '../shared/types';
import { getDockerVersion, execInContainer } from '../docker';
import type { WorkspaceManager } from '../workspace/manager';
import type { TerminalWebSocketServer } from '../terminal/websocket';
import { saveAgentConfig } from '../config/loader';

const WorkspaceStatusSchema = z.enum(['running', 'stopped', 'creating', 'error']);

const WorkspacePortsSchema = z.object({
  ssh: z.number(),
  http: z.number().optional(),
});

const WorkspaceInfoSchema = z.object({
  name: z.string(),
  status: WorkspaceStatusSchema,
  containerId: z.string(),
  created: z.string(),
  repo: z.string().optional(),
  ports: WorkspacePortsSchema,
});

const CredentialsSchema = z.object({
  env: z.record(z.string(), z.string()),
  files: z.record(z.string(), z.string()),
});

const ScriptsSchema = z.object({
  post_start: z.string().optional(),
});

const CodingAgentsSchema = z.object({
  opencode: z
    .object({
      api_key: z.string().optional(),
      api_base_url: z.string().optional(),
    })
    .optional(),
  github: z
    .object({
      token: z.string().optional(),
    })
    .optional(),
  claude_code: z
    .object({
      oauth_token: z.string().optional(),
    })
    .optional(),
});

export interface RouterContext {
  workspaces: WorkspaceManager;
  config: { get: () => AgentConfig; set: (config: AgentConfig) => void };
  configDir: string;
  startTime: number;
  terminalServer: TerminalWebSocketServer;
}

function mapErrorToORPC(err: unknown, defaultMessage: string): never {
  const message = err instanceof Error ? err.message : defaultMessage;
  if (message.includes('not found')) {
    throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
  }
  if (message.includes('already exists')) {
    throw new ORPCError('CONFLICT', { message });
  }
  throw new ORPCError('INTERNAL_SERVER_ERROR', { message });
}

export function createRouter(ctx: RouterContext) {
  const listWorkspaces = os.handler(async () => {
    return ctx.workspaces.list();
  });

  const getWorkspace = os.input(z.object({ name: z.string() })).handler(async ({ input }) => {
    const workspace = await ctx.workspaces.get(input.name);
    if (!workspace) {
      throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
    }
    return workspace;
  });

  const createWorkspace = os
    .input(
      z.object({
        name: z.string(),
        clone: z.string().optional(),
        env: z.record(z.string(), z.string()).optional(),
      })
    )
    .output(WorkspaceInfoSchema)
    .handler(async ({ input }) => {
      try {
        return await ctx.workspaces.create(input);
      } catch (err) {
        mapErrorToORPC(err, 'Failed to create workspace');
      }
    });

  const deleteWorkspace = os.input(z.object({ name: z.string() })).handler(async ({ input }) => {
    try {
      ctx.terminalServer.closeConnectionsForWorkspace(input.name);
      await ctx.workspaces.delete(input.name);
      return { success: true };
    } catch (err) {
      mapErrorToORPC(err, 'Failed to delete workspace');
    }
  });

  const startWorkspace = os
    .input(z.object({ name: z.string() }))
    .output(WorkspaceInfoSchema)
    .handler(async ({ input }) => {
      try {
        return await ctx.workspaces.start(input.name);
      } catch (err) {
        mapErrorToORPC(err, 'Failed to start workspace');
      }
    });

  const stopWorkspace = os
    .input(z.object({ name: z.string() }))
    .output(WorkspaceInfoSchema)
    .handler(async ({ input }) => {
      try {
        ctx.terminalServer.closeConnectionsForWorkspace(input.name);
        return await ctx.workspaces.stop(input.name);
      } catch (err) {
        mapErrorToORPC(err, 'Failed to stop workspace');
      }
    });

  const getLogs = os
    .input(z.object({ name: z.string(), tail: z.number().optional().default(100) }))
    .handler(async ({ input }) => {
      try {
        return await ctx.workspaces.getLogs(input.name, input.tail);
      } catch (err) {
        mapErrorToORPC(err, 'Failed to get logs');
      }
    });

  const getInfo = os.handler(async () => {
    let dockerVersion = 'unknown';
    try {
      dockerVersion = await getDockerVersion();
    } catch {
      dockerVersion = 'unavailable';
    }

    const allWorkspaces = await ctx.workspaces.list();

    return {
      hostname: os_module.hostname(),
      uptime: Math.floor((Date.now() - ctx.startTime) / 1000),
      workspacesCount: allWorkspaces.length,
      dockerVersion,
      terminalConnections: ctx.terminalServer.getConnectionCount(),
    };
  });

  const getCredentials = os.output(CredentialsSchema).handler(async () => {
    return ctx.config.get().credentials;
  });

  const updateCredentials = os
    .input(CredentialsSchema)
    .output(CredentialsSchema)
    .handler(async ({ input }) => {
      const currentConfig = ctx.config.get();
      const newConfig = { ...currentConfig, credentials: input };
      ctx.config.set(newConfig);
      await saveAgentConfig(newConfig, ctx.configDir);
      return input;
    });

  const getScripts = os.output(ScriptsSchema).handler(async () => {
    return ctx.config.get().scripts;
  });

  const updateScripts = os
    .input(ScriptsSchema)
    .output(ScriptsSchema)
    .handler(async ({ input }) => {
      const currentConfig = ctx.config.get();
      const newConfig = { ...currentConfig, scripts: input };
      ctx.config.set(newConfig);
      await saveAgentConfig(newConfig, ctx.configDir);
      return input;
    });

  const getAgents = os.output(CodingAgentsSchema).handler(async () => {
    return ctx.config.get().agents || {};
  });

  const updateAgents = os
    .input(CodingAgentsSchema)
    .output(CodingAgentsSchema)
    .handler(async ({ input }) => {
      const currentConfig = ctx.config.get();
      const newConfig = { ...currentConfig, agents: input };
      ctx.config.set(newConfig);
      await saveAgentConfig(newConfig, ctx.configDir);
      return input;
    });

  const listSessions = os
    .input(
      z.object({
        workspaceName: z.string(),
        agentType: z.enum(['claude-code', 'opencode', 'codex']).optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      })
    )
    .handler(async ({ input }) => {
      const workspace = await ctx.workspaces.get(input.workspaceName);
      if (!workspace) {
        throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
      }
      if (workspace.status !== 'running') {
        throw new ORPCError('PRECONDITION_FAILED', { message: 'Workspace is not running' });
      }

      const containerName = `workspace-${input.workspaceName}`;

      type RawSession = {
        id: string;
        agentType: string;
        projectPath: string;
        messageCount: number;
        mtime: number;
        prompt?: string;
        name?: string;
      };

      const rawSessions: RawSession[] = [];

      const claudeResult = await execInContainer(
        containerName,
        [
          'sh',
          '-c',
          'find /home/workspace/.claude/projects -name "*.jsonl" -type f -printf "%p\\t%T@\\t" -exec wc -l {} \\; 2>/dev/null || true',
        ],
        { user: 'workspace' }
      );

      if (claudeResult.exitCode === 0 && claudeResult.stdout.trim()) {
        const lines = claudeResult.stdout.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const file = parts[0];
            const mtime = Math.floor(parseFloat(parts[1]) || 0);
            const wcOutput = parts[2] || '0';
            const count = parseInt(wcOutput.trim().split(' ')[0], 10) || 0;

            const id = file.split('/').pop()?.replace('.jsonl', '') || '';
            const projDir = file.split('/').slice(-2, -1)[0] || '';

            rawSessions.push({
              id,
              agentType: 'claude-code',
              projectPath: projDir,
              messageCount: count,
              mtime,
            });
          }
        }
      }

      const opencodeResult = await execInContainer(
        containerName,
        [
          'sh',
          '-c',
          'find /home/workspace/.local/share/opencode/storage/session -name "ses_*.json" -type f 2>/dev/null || true',
        ],
        { user: 'workspace' }
      );

      if (opencodeResult.exitCode === 0 && opencodeResult.stdout.trim()) {
        const files = opencodeResult.stdout.trim().split('\n').filter(Boolean);
        const catAll = await execInContainer(
          containerName,
          ['sh', '-c', `cat ${files.map((f) => `"${f}"`).join(' ')} 2>/dev/null | jq -s '.'`],
          { user: 'workspace' }
        );

        if (catAll.exitCode === 0) {
          try {
            const sessions = JSON.parse(catAll.stdout) as Array<{
              id?: string;
              title?: string;
              directory?: string;
              time?: { updated?: number };
            }>;

            for (let i = 0; i < sessions.length; i++) {
              const data = sessions[i];
              const file = files[i];
              const id = file.split('/').pop()?.replace('.json', '') || '';
              const mtime = Math.floor((data.time?.updated || 0) / 1000);

              rawSessions.push({
                id,
                agentType: 'opencode',
                projectPath: data.directory || '',
                messageCount: 1,
                mtime,
                name: data.title || undefined,
              });
            }
          } catch {
            // Skip on parse error
          }
        }
      }

      const codexResult = await execInContainer(
        containerName,
        [
          'sh',
          '-c',
          'find /home/workspace/.codex/sessions -name "rollout-*.jsonl" -type f -printf "%p\\t%T@\\t" -exec wc -l {} \\; 2>/dev/null || true',
        ],
        { user: 'workspace' }
      );

      if (codexResult.exitCode === 0 && codexResult.stdout.trim()) {
        const lines = codexResult.stdout.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const file = parts[0];
            const mtime = Math.floor(parseFloat(parts[1]) || 0);
            const wcOutput = parts[2] || '0';
            const count = parseInt(wcOutput.trim().split(' ')[0], 10) || 0;

            const id = file.split('/').pop()?.replace('.jsonl', '') || '';
            const projPath = file
              .replace('/home/workspace/.codex/sessions/', '')
              .replace(/\/[^/]+$/, '');

            rawSessions.push({
              id,
              agentType: 'codex',
              projectPath: projPath,
              messageCount: count,
              mtime,
            });
          }
        }
      }

      const sessions = rawSessions
        .filter((s) => !input.agentType || s.agentType === input.agentType)
        .filter((s) => s.messageCount > 0)
        .map((s) => {
          let firstPrompt: string | null = null;
          if (s.prompt) {
            try {
              const line = JSON.parse(s.prompt);
              if (line.content) {
                const content = Array.isArray(line.content)
                  ? line.content.find((c: { type: string; text?: string }) => c.type === 'text')
                      ?.text
                  : line.content;
                firstPrompt = typeof content === 'string' ? content.slice(0, 200) : null;
              }
            } catch {
              firstPrompt = null;
            }
          }
          return {
            id: s.id,
            name: s.name || null,
            agentType: s.agentType,
            projectPath: s.projectPath,
            messageCount: s.messageCount,
            lastActivity: new Date(s.mtime * 1000).toISOString(),
            firstPrompt,
          };
        })
        .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

      const paginatedSessions = sessions.slice(input.offset, input.offset + input.limit);

      return {
        sessions: paginatedSessions,
        total: sessions.length,
        hasMore: input.offset + input.limit < sessions.length,
      };
    });

  const getSession = os
    .input(
      z.object({
        workspaceName: z.string(),
        sessionId: z.string(),
        agentType: z.enum(['claude-code', 'opencode', 'codex']).optional(),
      })
    )
    .handler(async ({ input }) => {
      const workspace = await ctx.workspaces.get(input.workspaceName);
      if (!workspace) {
        throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
      }
      if (workspace.status !== 'running') {
        throw new ORPCError('PRECONDITION_FAILED', { message: 'Workspace is not running' });
      }

      const containerName = `workspace-${input.workspaceName}`;
      const messages: Array<{
        type: string;
        content: string | null;
        timestamp: string | null;
      }> = [];

      const parseContent = (content: unknown): string | null => {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
          const text = content.find(
            (c: { type: string; text?: string }) => c.type === 'text'
          )?.text;
          return typeof text === 'string' ? text : null;
        }
        return null;
      };

      if (!input.agentType || input.agentType === 'claude-code') {
        const safeSessionId = input.sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
        const findResult = await execInContainer(
          containerName,
          [
            'find',
            '/home/workspace/.claude/projects',
            '-name',
            `${safeSessionId}.jsonl`,
            '-type',
            'f',
          ],
          { user: 'workspace' }
        );

        const foundPath = findResult.stdout.trim().split('\n')[0];
        if (findResult.exitCode === 0 && foundPath) {
          const filePath = foundPath;
          const catResult = await execInContainer(containerName, ['cat', filePath], {
            user: 'workspace',
          });

          if (catResult.exitCode === 0) {
            const lines = catResult.stdout.split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const obj = JSON.parse(line);
                if (obj.role === 'user' || obj.type === 'user') {
                  messages.push({
                    type: 'user',
                    content: parseContent(obj.content),
                    timestamp: obj.timestamp || null,
                  });
                } else if (obj.role === 'assistant' || obj.type === 'assistant') {
                  messages.push({
                    type: 'assistant',
                    content: parseContent(obj.content),
                    timestamp: obj.timestamp || null,
                  });
                }
              } catch {
                continue;
              }
            }
            return { id: input.sessionId, agentType: 'claude-code', messages };
          }
        }
      }

      if (!input.agentType || input.agentType === 'opencode') {
        const findResult = await execInContainer(
          containerName,
          [
            'bash',
            '-c',
            `find /home/workspace/.local/share/opencode/storage/session -name "${input.sessionId}.json" -type f 2>/dev/null | head -1`,
          ],
          { user: 'workspace' }
        );

        if (findResult.exitCode === 0 && findResult.stdout.trim()) {
          const filePath = findResult.stdout.trim();
          const catResult = await execInContainer(containerName, ['cat', filePath], {
            user: 'workspace',
          });

          if (catResult.exitCode === 0) {
            try {
              const session = JSON.parse(catResult.stdout) as { id: string };
              const msgDir = `/home/workspace/.local/share/opencode/storage/message/${session.id}`;

              const listMsgsResult = await execInContainer(
                containerName,
                ['bash', '-c', `ls -1 "${msgDir}"/msg_*.json 2>/dev/null | sort`],
                { user: 'workspace' }
              );

              if (listMsgsResult.exitCode === 0 && listMsgsResult.stdout.trim()) {
                const msgFiles = listMsgsResult.stdout.trim().split('\n').filter(Boolean);
                for (const msgFile of msgFiles) {
                  const msgResult = await execInContainer(containerName, ['cat', msgFile], {
                    user: 'workspace',
                  });
                  if (msgResult.exitCode === 0) {
                    try {
                      const msg = JSON.parse(msgResult.stdout) as {
                        role?: string;
                        content?: unknown;
                        time?: { created?: number };
                      };
                      if (msg.role === 'user' || msg.role === 'assistant') {
                        messages.push({
                          type: msg.role,
                          content: parseContent(msg.content),
                          timestamp: msg.time?.created
                            ? new Date(msg.time.created).toISOString()
                            : null,
                        });
                      }
                    } catch {
                      continue;
                    }
                  }
                }
              }
              return { id: input.sessionId, agentType: 'opencode', messages };
            } catch {
              // Session parse failed
            }
          }
        }
      }

      if (!input.agentType || input.agentType === 'codex') {
        const findResult = await execInContainer(
          containerName,
          [
            'bash',
            '-c',
            `find /home/workspace/.codex/sessions -name "rollout-*.jsonl" -type f 2>/dev/null`,
          ],
          { user: 'workspace' }
        );

        if (findResult.exitCode === 0 && findResult.stdout.trim()) {
          const files = findResult.stdout.trim().split('\n').filter(Boolean);
          for (const filePath of files) {
            const headResult = await execInContainer(
              containerName,
              ['bash', '-c', `head -1 "${filePath}"`],
              { user: 'workspace' }
            );

            let sessionId = filePath.split('/').pop()?.replace('.jsonl', '') || '';
            if (headResult.exitCode === 0 && headResult.stdout.trim()) {
              try {
                const meta = JSON.parse(headResult.stdout.trim());
                if (meta.session_id) sessionId = meta.session_id;
              } catch {
                // Use filename
              }
            }

            if (sessionId === input.sessionId) {
              const catResult = await execInContainer(containerName, ['cat', filePath], {
                user: 'workspace',
              });

              if (catResult.exitCode === 0) {
                const lines = catResult.stdout.split('\n').filter(Boolean);
                for (let i = 1; i < lines.length; i++) {
                  try {
                    const event = JSON.parse(lines[i]) as {
                      payload?: {
                        role?: string;
                        content?: unknown;
                        message?: { role?: string; content?: unknown };
                      };
                      timestamp?: number;
                    };
                    const role = event.payload?.role || event.payload?.message?.role;
                    const content = event.payload?.content || event.payload?.message?.content;
                    if (role === 'user' || role === 'assistant') {
                      messages.push({
                        type: role,
                        content: parseContent(content),
                        timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : null,
                      });
                    }
                  } catch {
                    continue;
                  }
                }
                return { id: input.sessionId, agentType: 'codex', messages };
              }
            }
          }
        }
      }

      throw new ORPCError('NOT_FOUND', { message: 'Session not found' });
    });

  return {
    workspaces: {
      list: listWorkspaces,
      get: getWorkspace,
      create: createWorkspace,
      delete: deleteWorkspace,
      start: startWorkspace,
      stop: stopWorkspace,
      logs: getLogs,
    },
    sessions: {
      list: listSessions,
      get: getSession,
    },
    info: getInfo,
    config: {
      credentials: {
        get: getCredentials,
        update: updateCredentials,
      },
      scripts: {
        get: getScripts,
        update: updateScripts,
      },
      agents: {
        get: getAgents,
        update: updateAgents,
      },
    },
  };
}

export type AppRouter = ReturnType<typeof createRouter>;
