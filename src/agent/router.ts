import { os, ORPCError } from '@orpc/server';
import * as z from 'zod';
import os_module from 'os';
import { type AgentConfig } from '../shared/types';
import { getDockerVersion, execInContainer } from '../docker';
import type { WorkspaceManager } from '../workspace/manager';
import type { TerminalWebSocketServer } from '../terminal/websocket';
import { saveAgentConfig } from '../config/loader';
import {
  setSessionName,
  getSessionNamesForWorkspace,
  deleteSessionName,
} from '../sessions/metadata';
import { parseClaudeSessionContent } from '../sessions/parser';
import type { SessionMessage } from '../sessions/types';

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
      zen_token: z.string().optional(),
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
      model: z.string().optional(),
    })
    .optional(),
});

export interface RouterContext {
  workspaces: WorkspaceManager;
  config: { get: () => AgentConfig; set: (config: AgentConfig) => void };
  configDir: string;
  stateDir: string;
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

function decodeClaudeProjectPath(encoded: string): string {
  return encoded.replace(/-/g, '/');
}

function extractFirstUserPrompt(messages: SessionMessage[]): string | null {
  const firstPrompt = messages.find(
    (msg) => msg.type === 'user' && msg.content && msg.content.trim().length > 0
  );
  return firstPrompt?.content ? firstPrompt.content.slice(0, 200) : null;
}

function extractClaudeSessionName(content: string): string | null {
  const lines = content.split('\n').filter((line) => line.trim());
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as { type?: string; subtype?: string; name?: string };
      if (obj.type === 'system' && obj.subtype === 'session_name') {
        return obj.name || null;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractContent(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content.find((c: { type: string; text?: string }) => c.type === 'text')?.text;
    return typeof text === 'string' ? text : null;
  }
  return null;
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

  const syncWorkspace = os.input(z.object({ name: z.string() })).handler(async ({ input }) => {
    try {
      await ctx.workspaces.sync(input.name);
      return { success: true };
    } catch (err) {
      mapErrorToORPC(err, 'Failed to sync workspace');
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

  type ListSessionsInput = {
    workspaceName: string;
    agentType?: 'claude-code' | 'opencode' | 'codex';
    limit?: number;
    offset?: number;
  };

  async function listSessionsCore(input: ListSessionsInput) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
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
      agentType: 'claude-code' | 'opencode' | 'codex';
      projectPath: string;
      mtime: number;
      filePath: string;
      name?: string;
    };

    const rawSessions: RawSession[] = [];

    const claudeResult = await execInContainer(
      containerName,
      [
        'bash',
        '-c',
        'find /home/workspace/.claude/projects -name "*.jsonl" -type f ! -name "agent-*.jsonl" -printf "%p\\t%T@\\t%s\\n" 2>/dev/null || true',
      ],
      { user: 'workspace' }
    );

    if (claudeResult.exitCode === 0 && claudeResult.stdout.trim()) {
      const lines = claudeResult.stdout.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const file = parts[0];
          const mtime = Math.floor(parseFloat(parts[1]) || 0);
          const size = parseInt(parts[2], 10) || 0;
          if (size === 0) continue;

          const id = file.split('/').pop()?.replace('.jsonl', '') || '';
          const projDir = file.split('/').slice(-2, -1)[0] || '';
          const projectPath = decodeClaudeProjectPath(projDir);
          if (!projectPath.startsWith('/workspace') && !projectPath.startsWith('/home/workspace'))
            continue;

          rawSessions.push({
            id,
            agentType: 'claude-code',
            mtime,
            projectPath,
            filePath: file,
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
            const id = data.id || file.split('/').pop()?.replace('.json', '') || '';
            const mtime = Math.floor((data.time?.updated || 0) / 1000);

            rawSessions.push({
              id,
              agentType: 'opencode',
              projectPath: data.directory || '',
              mtime,
              name: data.title || undefined,
              filePath: file,
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

          const id = file.split('/').pop()?.replace('.jsonl', '') || '';
          const projPath = file
            .replace('/home/workspace/.codex/sessions/', '')
            .replace(/\/[^/]+$/, '');

          rawSessions.push({
            id,
            agentType: 'codex',
            projectPath: projPath,
            mtime,
            filePath: file,
          });
        }
      }
    }

    const customNames = await getSessionNamesForWorkspace(ctx.stateDir, input.workspaceName);

    const filteredSessions = rawSessions
      .filter((s) => !input.agentType || s.agentType === input.agentType)
      .sort((a, b) => b.mtime - a.mtime);

    const paginatedRawSessions = filteredSessions.slice(offset, offset + limit);
    const sessions = [];

    for (const session of paginatedRawSessions) {
      if (session.agentType === 'claude-code') {
        const catResult = await execInContainer(containerName, ['cat', session.filePath], {
          user: 'workspace',
        });

        if (catResult.exitCode !== 0) {
          continue;
        }

        const messages = parseClaudeSessionContent(catResult.stdout).filter(
          (msg) => msg.type !== 'system'
        );
        const firstPrompt = extractFirstUserPrompt(messages);
        const name = extractClaudeSessionName(catResult.stdout);

        if (messages.length === 0) {
          continue;
        }

        sessions.push({
          id: session.id,
          name: customNames[session.id] || name || null,
          agentType: session.agentType,
          projectPath: session.projectPath,
          messageCount: messages.length,
          lastActivity: new Date(session.mtime * 1000).toISOString(),
          firstPrompt,
        });
        continue;
      }

      if (session.agentType === 'opencode') {
        const msgDir = `/home/workspace/.local/share/opencode/storage/message/${session.id}`;
        const listMsgsResult = await execInContainer(
          containerName,
          ['bash', '-c', `ls -1 "${msgDir}"/msg_*.json 2>/dev/null | sort`],
          { user: 'workspace' }
        );

        const messages: Array<{ type: 'user' | 'assistant'; content?: string }> = [];

        if (listMsgsResult.exitCode === 0 && listMsgsResult.stdout.trim()) {
          const msgFiles = listMsgsResult.stdout.trim().split('\n').filter(Boolean);
          for (const msgFile of msgFiles) {
            const msgResult = await execInContainer(containerName, ['cat', msgFile], {
              user: 'workspace',
            });
            if (msgResult.exitCode !== 0) continue;
            try {
              const msg = JSON.parse(msgResult.stdout) as {
                role?: 'user' | 'assistant';
                content?: unknown;
              };
              if (msg.role === 'user' || msg.role === 'assistant') {
                const content = extractContent(msg.content);
                messages.push({ type: msg.role, content: content || undefined });
              }
            } catch {
              continue;
            }
          }
        }

        const firstPrompt = messages.find(
          (msg) => msg.type === 'user' && msg.content && msg.content.trim().length > 0
        )?.content;

        if (messages.length === 0) {
          continue;
        }

        sessions.push({
          id: session.id,
          name: customNames[session.id] || session.name || null,
          agentType: session.agentType,
          projectPath: session.projectPath,
          messageCount: messages.length,
          lastActivity: new Date(session.mtime * 1000).toISOString(),
          firstPrompt: firstPrompt ? firstPrompt.slice(0, 200) : null,
        });
        continue;
      }

      const catResult = await execInContainer(containerName, ['cat', session.filePath], {
        user: 'workspace',
      });

      if (catResult.exitCode !== 0) {
        continue;
      }

      const lines = catResult.stdout.split('\n').filter(Boolean);
      let sessionId = session.id;
      if (lines.length > 0) {
        try {
          const meta = JSON.parse(lines[0]) as { session_id?: string };
          if (meta.session_id) {
            sessionId = meta.session_id;
          }
        } catch {
          // ignore
        }
      }

      const messages: Array<{ type: 'user' | 'assistant'; content?: string }> = [];
      for (let i = 1; i < lines.length; i++) {
        try {
          const event = JSON.parse(lines[i]) as {
            payload?: {
              role?: 'user' | 'assistant';
              content?: unknown;
              message?: { role?: 'user' | 'assistant'; content?: unknown };
            };
          };
          const role = event.payload?.role || event.payload?.message?.role;
          const content = event.payload?.content || event.payload?.message?.content;
          if (role === 'user' || role === 'assistant') {
            const textContent = extractContent(content);
            messages.push({ type: role, content: textContent || undefined });
          }
        } catch {
          continue;
        }
      }

      const firstPrompt = messages.find(
        (msg) => msg.type === 'user' && msg.content && msg.content.trim().length > 0
      )?.content;

      if (messages.length === 0) {
        continue;
      }

      sessions.push({
        id: sessionId,
        name: customNames[sessionId] || null,
        agentType: session.agentType,
        projectPath: session.projectPath,
        messageCount: messages.length,
        lastActivity: new Date(session.mtime * 1000).toISOString(),
        firstPrompt: firstPrompt ? firstPrompt.slice(0, 200) : null,
      });
    }

    return {
      sessions,
      total: filteredSessions.length,
      hasMore: offset + limit < filteredSessions.length,
    };
  }

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
      return listSessionsCore(input);
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
      const messages: SessionMessage[] = [];

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
            const parsed = parseClaudeSessionContent(catResult.stdout)
              .filter((msg) => msg.type !== 'system')
              .filter(
                (msg) =>
                  msg.type === 'tool_use' ||
                  msg.type === 'tool_result' ||
                  (msg.content && msg.content.trim().length > 0)
              );
            return { id: input.sessionId, agentType: 'claude-code', messages: parsed };
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
                        const parsedContent = extractContent(msg.content);
                        messages.push({
                          type: msg.role,
                          content: parsedContent || undefined,
                          timestamp: msg.time?.created
                            ? new Date(msg.time.created).toISOString()
                            : undefined,
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
                      const parsedContent = extractContent(content);
                      messages.push({
                        type: role,
                        content: parsedContent || undefined,
                        timestamp: event.timestamp
                          ? new Date(event.timestamp).toISOString()
                          : undefined,
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

  const renameSession = os
    .input(
      z.object({
        workspaceName: z.string(),
        sessionId: z.string(),
        name: z.string().min(1).max(200),
      })
    )
    .handler(async ({ input }) => {
      await setSessionName(ctx.stateDir, input.workspaceName, input.sessionId, input.name);
      return { success: true };
    });

  const clearSessionName = os
    .input(
      z.object({
        workspaceName: z.string(),
        sessionId: z.string(),
      })
    )
    .handler(async ({ input }) => {
      await deleteSessionName(ctx.stateDir, input.workspaceName, input.sessionId);
      return { success: true };
    });

  const listAllSessions = os
    .input(
      z.object({
        agentType: z.enum(['claude-code', 'opencode', 'codex']).optional(),
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
      })
    )
    .handler(async ({ input }) => {
      const allWorkspaces = await ctx.workspaces.list();
      const runningWorkspaces = allWorkspaces.filter((w) => w.status === 'running');

      type SessionWithWorkspace = {
        id: string;
        name: string | null;
        agentType: string;
        projectPath: string;
        messageCount: number;
        lastActivity: string;
        firstPrompt: string | null;
        workspaceName: string;
      };

      const allSessions: SessionWithWorkspace[] = [];

      for (const workspace of runningWorkspaces) {
        try {
          const result = await listSessionsCore({
            workspaceName: workspace.name,
            agentType: input.agentType,
            limit: 1000,
            offset: 0,
          });
          for (const session of result.sessions) {
            allSessions.push({
              ...session,
              workspaceName: workspace.name,
            });
          }
        } catch {
          continue;
        }
      }

      allSessions.sort(
        (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );

      const paginatedSessions = allSessions.slice(input.offset, input.offset + input.limit);

      return {
        sessions: paginatedSessions,
        total: allSessions.length,
        hasMore: input.offset + input.limit < allSessions.length,
      };
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
      sync: syncWorkspace,
    },
    sessions: {
      list: listSessions,
      listAll: listAllSessions,
      get: getSession,
      rename: renameSession,
      clearName: clearSessionName,
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
