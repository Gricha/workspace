import { os, ORPCError } from '@orpc/server';
import * as z from 'zod';
import os_module from 'os';
import { promises as fs } from 'fs';
import path from 'path';
import { type AgentConfig, HOST_WORKSPACE_NAME } from '../shared/types';
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
import {
  discoverAllSessions,
  getSessionDetails as getAgentSessionDetails,
  getSessionMessages,
  findSessionMessages,
} from '../sessions/agents';

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

  const syncAllWorkspaces = os.handler(async () => {
    const workspaces = await ctx.workspaces.list();
    const runningWorkspaces = workspaces.filter((ws) => ws.status === 'running');
    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const ws of runningWorkspaces) {
      try {
        await ctx.workspaces.sync(ws.name);
        results.push({ name: ws.name, success: true });
      } catch (err) {
        results.push({ name: ws.name, success: false, error: (err as Error).message });
      }
    }

    return {
      synced: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
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

  type RawSession = {
    id: string;
    agentType: 'claude-code' | 'opencode' | 'codex';
    projectPath: string;
    mtime: number;
    filePath: string;
    name?: string;
  };

  async function listHostSessions(input: ListSessionsInput) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const homeDir = os_module.homedir();
    const rawSessions: RawSession[] = [];

    if (!input.agentType || input.agentType === 'claude-code') {
      const claudeProjectsDir = path.join(homeDir, '.claude', 'projects');
      try {
        const projectDirs = await fs.readdir(claudeProjectsDir);
        for (const projectDir of projectDirs) {
          const projectPath = path.join(claudeProjectsDir, projectDir);
          const stat = await fs.stat(projectPath);
          if (!stat.isDirectory()) continue;

          const files = await fs.readdir(projectPath);
          for (const file of files) {
            if (!file.endsWith('.jsonl') || file.startsWith('agent-')) continue;
            const filePath = path.join(projectPath, file);
            const fileStat = await fs.stat(filePath);
            const sessionId = file.replace('.jsonl', '');
            rawSessions.push({
              id: sessionId,
              agentType: 'claude-code',
              projectPath: projectDir.replace(/-/g, '/'),
              mtime: fileStat.mtimeMs,
              filePath,
            });
          }
        }
      } catch {
        // Directory doesn't exist or not readable
      }
    }

    if (!input.agentType || input.agentType === 'opencode') {
      const opencodeDir = path.join(homeDir, '.opencode', 'sessions');
      try {
        const sessions = await fs.readdir(opencodeDir);
        for (const sessionDir of sessions) {
          const sessionPath = path.join(opencodeDir, sessionDir);
          const stat = await fs.stat(sessionPath);
          if (!stat.isDirectory()) continue;

          const sessionFile = path.join(sessionPath, 'session.json');
          try {
            const sessionStat = await fs.stat(sessionFile);
            rawSessions.push({
              id: sessionDir,
              agentType: 'opencode',
              projectPath: homeDir,
              mtime: sessionStat.mtimeMs,
              filePath: sessionFile,
            });
          } catch {
            // session.json doesn't exist
          }
        }
      } catch {
        // Directory doesn't exist
      }
    }

    rawSessions.sort((a, b) => b.mtime - a.mtime);
    const sessionNames = await getSessionNamesForWorkspace(ctx.configDir, HOST_WORKSPACE_NAME);

    const sessions = await Promise.all(
      rawSessions.map(async (raw) => {
        let firstPrompt: string | null = null;
        let messageCount = 0;

        if (raw.agentType === 'claude-code') {
          try {
            const fileContent = await fs.readFile(raw.filePath, 'utf-8');
            const lines = fileContent.trim().split('\n').filter(Boolean);
            messageCount = lines.length;
            for (const line of lines) {
              try {
                const entry = JSON.parse(line);
                if ((entry.type === 'user' || entry.type === 'human') && entry.message?.content) {
                  const msgContent = entry.message.content;
                  if (Array.isArray(msgContent)) {
                    const textBlock = msgContent.find((b: { type: string }) => b.type === 'text');
                    if (textBlock?.text) {
                      firstPrompt = textBlock.text.slice(0, 200);
                      break;
                    }
                  } else if (typeof msgContent === 'string') {
                    firstPrompt = msgContent.slice(0, 200);
                    break;
                  }
                }
              } catch {
                continue;
              }
            }
          } catch {
            // Can't read file
          }
        } else if (raw.agentType === 'opencode') {
          try {
            const sessionContent = await fs.readFile(raw.filePath, 'utf-8');
            const sessionData = JSON.parse(sessionContent);
            messageCount = sessionData.messages?.length || 0;
            if (sessionData.title) {
              firstPrompt = sessionData.title;
            }
          } catch {
            // Can't read file
          }
        }

        return {
          id: raw.id,
          name: sessionNames[raw.id] || null,
          agentType: raw.agentType,
          projectPath: raw.projectPath,
          messageCount,
          lastActivity: new Date(raw.mtime).toISOString(),
          firstPrompt,
        };
      })
    );

    const nonEmptySessions = sessions.filter((s) => s.messageCount > 0);
    const paginatedSessions = nonEmptySessions.slice(offset, offset + limit);
    return {
      sessions: paginatedSessions,
      total: nonEmptySessions.length,
      hasMore: offset + limit < nonEmptySessions.length,
    };
  }

  async function getHostSession(
    sessionId: string,
    agentType?: 'claude-code' | 'opencode' | 'codex'
  ) {
    const homeDir = os_module.homedir();
    const messages: SessionMessage[] = [];

    if (!agentType || agentType === 'claude-code') {
      const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
      const claudeProjectsDir = path.join(homeDir, '.claude', 'projects');

      try {
        const projectDirs = await fs.readdir(claudeProjectsDir);
        for (const projectDir of projectDirs) {
          const sessionFile = path.join(claudeProjectsDir, projectDir, `${safeSessionId}.jsonl`);
          try {
            const content = await fs.readFile(sessionFile, 'utf-8');
            const parsed = parseClaudeSessionContent(content)
              .filter((msg) => msg.type !== 'system')
              .filter(
                (msg) =>
                  msg.type === 'tool_use' ||
                  msg.type === 'tool_result' ||
                  (msg.content && msg.content.trim().length > 0)
              );
            messages.push(...parsed);
            break;
          } catch {
            // File not found in this project dir
          }
        }
      } catch {
        // Directory doesn't exist
      }

      if (messages.length > 0) {
        return { id: sessionId, agentType: 'claude-code', messages };
      }
    }

    if (!agentType || agentType === 'opencode') {
      const sessionDir = path.join(homeDir, '.opencode', 'sessions', sessionId);
      const partsDir = path.join(sessionDir, 'part');

      try {
        const partFiles = await fs.readdir(partsDir);
        const sortedParts = partFiles.sort();

        for (const partFile of sortedParts) {
          const partPath = path.join(partsDir, partFile);
          try {
            const partContent = await fs.readFile(partPath, 'utf-8');
            const part = JSON.parse(partContent);

            if (part.role === 'user' && part.content) {
              const textContent = Array.isArray(part.content)
                ? part.content
                    .filter((c: { type: string }) => c.type === 'text')
                    .map((c: { text: string }) => c.text)
                    .join('\n')
                : part.content;
              messages.push({
                type: 'user',
                content: textContent,
                timestamp: part.time || null,
              });
            } else if (part.role === 'assistant') {
              if (part.content) {
                const textContent = Array.isArray(part.content)
                  ? part.content
                      .filter((c: { type: string }) => c.type === 'text')
                      .map((c: { text: string }) => c.text)
                      .join('\n')
                  : part.content;
                if (textContent) {
                  messages.push({
                    type: 'assistant',
                    content: textContent,
                    timestamp: part.time || null,
                  });
                }
              }
            }
          } catch {
            // Can't parse part
          }
        }

        if (messages.length > 0) {
          return { id: sessionId, agentType: 'opencode', messages };
        }
      } catch {
        // Directory doesn't exist
      }
    }

    return { id: sessionId, messages };
  }

  async function listSessionsCore(input: ListSessionsInput) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const isHost = input.workspaceName === HOST_WORKSPACE_NAME;

    if (isHost) {
      const config = ctx.config.get();
      if (!config.allowHostAccess) {
        throw new ORPCError('PRECONDITION_FAILED', { message: 'Host access is disabled' });
      }
      return listHostSessions(input);
    }

    const workspace = await ctx.workspaces.get(input.workspaceName);
    if (!workspace) {
      throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
    }
    if (workspace.status !== 'running') {
      throw new ORPCError('PRECONDITION_FAILED', { message: 'Workspace is not running' });
    }

    const containerName = `workspace-${input.workspaceName}`;

    const rawSessions = await discoverAllSessions(containerName, execInContainer);

    const customNames = await getSessionNamesForWorkspace(ctx.stateDir, input.workspaceName);

    const filteredSessions = rawSessions
      .filter((s) => !input.agentType || s.agentType === input.agentType)
      .sort((a, b) => b.mtime - a.mtime);

    const paginatedRawSessions = filteredSessions.slice(offset, offset + limit);
    const sessions = [];

    for (const rawSession of paginatedRawSessions) {
      const details = await getAgentSessionDetails(containerName, rawSession, execInContainer);
      if (details) {
        sessions.push({
          ...details,
          name: customNames[details.id] || details.name,
        });
      }
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
      const isHost = input.workspaceName === HOST_WORKSPACE_NAME;

      if (isHost) {
        const config = ctx.config.get();
        if (!config.allowHostAccess) {
          throw new ORPCError('PRECONDITION_FAILED', { message: 'Host access is disabled' });
        }
        return getHostSession(input.sessionId, input.agentType);
      }

      const workspace = await ctx.workspaces.get(input.workspaceName);
      if (!workspace) {
        throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
      }
      if (workspace.status !== 'running') {
        throw new ORPCError('PRECONDITION_FAILED', { message: 'Workspace is not running' });
      }

      const containerName = `workspace-${input.workspaceName}`;

      const result = input.agentType
        ? await getSessionMessages(containerName, input.sessionId, input.agentType, execInContainer)
        : await findSessionMessages(containerName, input.sessionId, execInContainer);

      if (!result) {
        throw new ORPCError('NOT_FOUND', { message: 'Session not found' });
      }

      return result;
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

  const getHostInfo = os.handler(async () => {
    const config = ctx.config.get();
    return {
      enabled: config.allowHostAccess === true,
      hostname: os_module.hostname(),
      username: os_module.userInfo().username,
      homeDir: os_module.homedir(),
    };
  });

  const updateHostAccess = os
    .input(z.object({ enabled: z.boolean() }))
    .handler(async ({ input }) => {
      const currentConfig = ctx.config.get();
      const newConfig = { ...currentConfig, allowHostAccess: input.enabled };
      ctx.config.set(newConfig);
      await saveAgentConfig(newConfig, ctx.configDir);
      return {
        enabled: input.enabled,
        hostname: os_module.hostname(),
        username: os_module.userInfo().username,
        homeDir: os_module.homedir(),
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
      syncAll: syncAllWorkspaces,
    },
    sessions: {
      list: listSessions,
      listAll: listAllSessions,
      get: getSession,
      rename: renameSession,
      clearName: clearSessionName,
    },
    host: {
      info: getHostInfo,
      updateAccess: updateHostAccess,
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
