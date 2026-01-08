import { os, ORPCError } from '@orpc/server';
import * as z from 'zod';
import os_module from 'os';
import { promises as fs } from 'fs';
import path from 'path';
import type { AgentConfig } from '../shared/types';
import { HOST_WORKSPACE_NAME } from '../shared/client-types';
import { getDockerVersion, execInContainer } from '../docker';
import type { WorkspaceManager } from '../workspace/manager';
import type { TerminalWebSocketServer } from '../terminal/websocket';
import { saveAgentConfig } from '../config/loader';
import {
  setSessionName,
  getSessionNamesForWorkspace,
  deleteSessionName,
} from '../sessions/metadata';
import { discoverSSHKeys } from '../ssh/discovery';
import { parseClaudeSessionContent } from '../sessions/parser';
import type { SessionMessage } from '../sessions/types';
import {
  discoverAllSessions,
  getSessionDetails as getAgentSessionDetails,
  getSessionMessages,
  findSessionMessages,
  deleteSession as deleteSessionFromProvider,
  searchSessions as searchSessionsInContainer,
} from '../sessions/agents';
import type { SessionsCacheManager } from '../sessions/cache';
import type { ModelCacheManager } from '../models/cache';
import {
  discoverClaudeCodeModels,
  discoverHostOpencodeModels,
  discoverContainerOpencodeModels,
} from '../models/discovery';
import {
  listOpencodeSessions,
  getOpencodeSessionMessages,
  deleteOpencodeSession,
} from '../sessions/agents/opencode-storage';

const WorkspaceStatusSchema = z.enum(['running', 'stopped', 'creating', 'error']);

const WorkspacePortsSchema = z.object({
  ssh: z.number(),
  http: z.number().optional(),
  forwards: z.array(z.number()).optional(),
});

const WorkspaceInfoSchema = z.object({
  name: z.string(),
  status: WorkspaceStatusSchema,
  containerId: z.string(),
  created: z.string(),
  repo: z.string().optional(),
  ports: WorkspacePortsSchema,
  lastUsed: z.string().optional(),
});

const CredentialsSchema = z.object({
  env: z.record(z.string(), z.string()),
  files: z.record(z.string(), z.string()),
});

const ScriptsSchema = z.object({
  post_start: z.array(z.string()).optional(),
  fail_on_error: z.boolean().optional(),
});

const CodingAgentsSchema = z.object({
  opencode: z
    .object({
      zen_token: z.string().optional(),
      model: z.string().optional(),
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

const SSHKeyConfigSchema = z.object({
  copy: z.array(z.string()),
  authorize: z.array(z.string()),
});

const SSHSettingsSchema = z.object({
  autoAuthorizeHostKeys: z.boolean(),
  global: SSHKeyConfigSchema,
  workspaces: z.record(z.string(), SSHKeyConfigSchema.partial()),
});

const SSHKeyInfoSchema = z.object({
  name: z.string(),
  path: z.string(),
  publicKeyPath: z.string(),
  type: z.enum(['ed25519', 'rsa', 'ecdsa', 'dsa', 'unknown']),
  fingerprint: z.string(),
  hasPrivateKey: z.boolean(),
});

export interface TailscaleInfo {
  running: boolean;
  dnsName?: string;
  serveActive: boolean;
  httpsUrl?: string;
}

export interface RouterContext {
  workspaces: WorkspaceManager;
  config: { get: () => AgentConfig; set: (config: AgentConfig) => void };
  configDir: string;
  stateDir: string;
  startTime: number;
  terminalServer: TerminalWebSocketServer;
  sessionsCache: SessionsCacheManager;
  modelCache: ModelCacheManager;
  tailscale?: TailscaleInfo;
  triggerAutoSync: () => void;
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
        return await ctx.workspaces.start(input.name, {
          clone: input.clone,
          env: input.env,
        });
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

  const touchWorkspace = os
    .input(z.object({ name: z.string() }))
    .output(WorkspaceInfoSchema)
    .handler(async ({ input }) => {
      const workspace = await ctx.workspaces.touch(input.name);
      if (!workspace) {
        throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
      }
      return workspace;
    });

  const getPortForwards = os
    .input(z.object({ name: z.string() }))
    .output(z.object({ forwards: z.array(z.number()) }))
    .handler(async ({ input }) => {
      try {
        const forwards = await ctx.workspaces.getPortForwards(input.name);
        return { forwards };
      } catch (err) {
        mapErrorToORPC(err, 'Failed to get port forwards');
      }
    });

  const setPortForwards = os
    .input(z.object({ name: z.string(), forwards: z.array(z.number().int().min(1).max(65535)) }))
    .output(WorkspaceInfoSchema)
    .handler(async ({ input }) => {
      try {
        return await ctx.workspaces.setPortForwards(input.name, input.forwards);
      } catch (err) {
        mapErrorToORPC(err, 'Failed to set port forwards');
      }
    });

  const cloneWorkspace = os
    .input(
      z.object({
        sourceName: z.string(),
        cloneName: z.string(),
      })
    )
    .output(WorkspaceInfoSchema)
    .handler(async ({ input }) => {
      try {
        return await ctx.workspaces.clone(input.sourceName, input.cloneName);
      } catch (err) {
        mapErrorToORPC(err, 'Failed to clone workspace');
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
      tailscale: ctx.tailscale,
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
      ctx.triggerAutoSync();
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
      ctx.triggerAutoSync();
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
      ctx.triggerAutoSync();
      return input;
    });

  const getSSHSettings = os.output(SSHSettingsSchema).handler(async () => {
    const config = ctx.config.get();
    return (
      config.ssh || {
        autoAuthorizeHostKeys: true,
        global: { copy: [], authorize: [] },
        workspaces: {},
      }
    );
  });

  const updateSSHSettings = os
    .input(SSHSettingsSchema)
    .output(SSHSettingsSchema)
    .handler(async ({ input }) => {
      const currentConfig = ctx.config.get();
      const newConfig = { ...currentConfig, ssh: input };
      ctx.config.set(newConfig);
      await saveAgentConfig(newConfig, ctx.configDir);
      ctx.triggerAutoSync();
      return input;
    });

  const listSSHKeys = os.output(z.array(SSHKeyInfoSchema)).handler(async () => {
    return discoverSSHKeys();
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
      const opencodeSessions = await listOpencodeSessions();
      for (const session of opencodeSessions) {
        rawSessions.push({
          id: session.id,
          agentType: 'opencode',
          projectPath: session.directory || homeDir,
          mtime: session.mtime,
          filePath: session.file,
          name: session.title || undefined,
        });
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
          const sessionMessages = await getOpencodeSessionMessages(raw.id);
          const userAssistantMessages = sessionMessages.messages.filter(
            (m) => m.type === 'user' || m.type === 'assistant'
          );
          messageCount = userAssistantMessages.length;
          if (raw.name) {
            firstPrompt = raw.name;
          } else {
            const firstUserMsg = userAssistantMessages.find((m) => m.type === 'user' && m.content);
            if (firstUserMsg?.content) {
              firstPrompt = firstUserMsg.content.slice(0, 200);
            }
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
      const sessionData = await getOpencodeSessionMessages(sessionId);
      if (sessionData.messages.length > 0) {
        const opencodeMessages: SessionMessage[] = sessionData.messages.map((m) => ({
          type: m.type as SessionMessage['type'],
          content: m.content,
          toolName: m.toolName,
          toolId: m.toolId,
          toolInput: m.toolInput,
          timestamp: m.timestamp,
        }));
        return { id: sessionId, agentType: 'opencode', messages: opencodeMessages };
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
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .handler(async ({ input }) => {
      const isHost = input.workspaceName === HOST_WORKSPACE_NAME;

      let result;
      if (isHost) {
        const config = ctx.config.get();
        if (!config.allowHostAccess) {
          throw new ORPCError('PRECONDITION_FAILED', { message: 'Host access is disabled' });
        }
        result = await getHostSession(input.sessionId, input.agentType);
      } else {
        const workspace = await ctx.workspaces.get(input.workspaceName);
        if (!workspace) {
          throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
        }
        if (workspace.status !== 'running') {
          throw new ORPCError('PRECONDITION_FAILED', { message: 'Workspace is not running' });
        }

        const containerName = `workspace-${input.workspaceName}`;

        result = input.agentType
          ? await getSessionMessages(
              containerName,
              input.sessionId,
              input.agentType,
              execInContainer
            )
          : await findSessionMessages(containerName, input.sessionId, execInContainer);
      }

      if (!result) {
        throw new ORPCError('NOT_FOUND', { message: 'Session not found' });
      }

      const allMessages = result.messages || [];
      const total = allMessages.length;

      if (input.limit !== undefined) {
        const offset = input.offset ?? 0;
        const startIndex = Math.max(0, total - offset - input.limit);
        const endIndex = total - offset;
        const paginatedMessages = allMessages.slice(startIndex, endIndex);
        return {
          ...result,
          messages: paginatedMessages,
          total,
          hasMore: startIndex > 0,
        };
      }

      return { ...result, total, hasMore: false };
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

  const getRecentSessions = os
    .input(
      z.object({
        limit: z.number().optional().default(10),
      })
    )
    .handler(async ({ input }) => {
      const recent = await ctx.sessionsCache.getRecent(input.limit);
      return { sessions: recent };
    });

  const recordSessionAccess = os
    .input(
      z.object({
        workspaceName: z.string(),
        sessionId: z.string(),
        agentType: z.enum(['claude-code', 'opencode', 'codex']),
      })
    )
    .handler(async ({ input }) => {
      await ctx.sessionsCache.recordAccess(input.workspaceName, input.sessionId, input.agentType);
      return { success: true };
    });

  const deleteSession = os
    .input(
      z.object({
        workspaceName: z.string(),
        sessionId: z.string(),
        agentType: z.enum(['claude-code', 'opencode', 'codex']),
      })
    )
    .handler(async ({ input }) => {
      const isHost = input.workspaceName === HOST_WORKSPACE_NAME;

      if (isHost) {
        const config = ctx.config.get();
        if (!config.allowHostAccess) {
          throw new ORPCError('PRECONDITION_FAILED', { message: 'Host access is disabled' });
        }

        const result = await deleteHostSession(input.sessionId, input.agentType);
        if (!result.success) {
          throw new ORPCError('INTERNAL_SERVER_ERROR', {
            message: result.error || 'Failed to delete session',
          });
        }

        await deleteSessionName(ctx.stateDir, input.workspaceName, input.sessionId);
        await ctx.sessionsCache.removeSession(input.workspaceName, input.sessionId);

        return { success: true };
      }

      const workspace = await ctx.workspaces.get(input.workspaceName);
      if (!workspace) {
        throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
      }
      if (workspace.status !== 'running') {
        throw new ORPCError('PRECONDITION_FAILED', { message: 'Workspace is not running' });
      }

      const containerName = `workspace-${input.workspaceName}`;

      const result = await deleteSessionFromProvider(
        containerName,
        input.sessionId,
        input.agentType,
        execInContainer
      );

      if (!result.success) {
        throw new ORPCError('INTERNAL_SERVER_ERROR', {
          message: result.error || 'Failed to delete session',
        });
      }

      await deleteSessionName(ctx.stateDir, input.workspaceName, input.sessionId);
      await ctx.sessionsCache.removeSession(input.workspaceName, input.sessionId);

      return { success: true };
    });

  const searchSessions = os
    .input(
      z.object({
        workspaceName: z.string(),
        query: z.string().min(1).max(500),
      })
    )
    .handler(async ({ input }) => {
      const isHost = input.workspaceName === HOST_WORKSPACE_NAME;

      if (isHost) {
        const config = ctx.config.get();
        if (!config.allowHostAccess) {
          throw new ORPCError('PRECONDITION_FAILED', { message: 'Host access is disabled' });
        }

        const results = await searchHostSessions(input.query);
        return { results };
      }

      const workspace = await ctx.workspaces.get(input.workspaceName);
      if (!workspace) {
        throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
      }
      if (workspace.status !== 'running') {
        throw new ORPCError('PRECONDITION_FAILED', { message: 'Workspace is not running' });
      }

      const containerName = `workspace-${input.workspaceName}`;
      const results = await searchSessionsInContainer(containerName, input.query, execInContainer);

      return { results };
    });

  async function searchHostSessions(query: string): Promise<
    Array<{
      sessionId: string;
      agentType: 'claude-code' | 'opencode' | 'codex';
      matchCount: number;
    }>
  > {
    const homeDir = os_module.homedir();
    const safeQuery = query.replace(/['"\\]/g, '\\$&');
    const searchPaths = [
      path.join(homeDir, '.claude', 'projects'),
      path.join(homeDir, '.local', 'share', 'opencode', 'storage'),
      path.join(homeDir, '.codex', 'sessions'),
    ].filter((p) => {
      try {
        require('fs').accessSync(p);
        return true;
      } catch {
        return false;
      }
    });

    if (searchPaths.length === 0) {
      return [];
    }

    const { execSync } = await import('child_process');
    try {
      const output = execSync(
        `rg -l -i --no-messages "${safeQuery}" ${searchPaths.join(' ')} 2>/dev/null | head -100`,
        {
          encoding: 'utf-8',
          timeout: 30000,
        }
      );

      const files = output.trim().split('\n').filter(Boolean);
      const results: Array<{
        sessionId: string;
        agentType: 'claude-code' | 'opencode' | 'codex';
        matchCount: number;
      }> = [];

      for (const file of files) {
        let sessionId: string | null = null;
        let agentType: 'claude-code' | 'opencode' | 'codex' | null = null;

        if (file.includes('/.claude/projects/')) {
          const match = file.match(/\/([^/]+)\.jsonl$/);
          if (match && !match[1].startsWith('agent-')) {
            sessionId = match[1];
            agentType = 'claude-code';
          }
        } else if (file.includes('/.local/share/opencode/storage/')) {
          if (file.includes('/session/') && file.endsWith('.json')) {
            const match = file.match(/\/(ses_[^/]+)\.json$/);
            if (match) {
              sessionId = match[1];
              agentType = 'opencode';
            }
          }
        } else if (file.includes('/.codex/sessions/')) {
          const match = file.match(/\/([^/]+)\.jsonl$/);
          if (match) {
            sessionId = match[1];
            agentType = 'codex';
          }
        }

        if (sessionId && agentType) {
          results.push({ sessionId, agentType, matchCount: 1 });
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  async function deleteHostSession(
    sessionId: string,
    agentType: 'claude-code' | 'opencode' | 'codex'
  ): Promise<{ success: boolean; error?: string }> {
    const homeDir = os_module.homedir();

    if (agentType === 'claude-code') {
      const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
      const claudeProjectsDir = path.join(homeDir, '.claude', 'projects');

      try {
        const projectDirs = await fs.readdir(claudeProjectsDir);
        for (const projectDir of projectDirs) {
          const sessionFile = path.join(claudeProjectsDir, projectDir, `${safeSessionId}.jsonl`);
          try {
            await fs.unlink(sessionFile);
            return { success: true };
          } catch {
            continue;
          }
        }
      } catch {
        return { success: false, error: 'Session not found' };
      }
      return { success: false, error: 'Session not found' };
    }

    if (agentType === 'opencode') {
      return deleteOpencodeSession(sessionId);
    }

    if (agentType === 'codex') {
      const codexSessionsDir = path.join(homeDir, '.codex', 'sessions');
      try {
        const files = await fs.readdir(codexSessionsDir);
        for (const file of files) {
          if (!file.endsWith('.jsonl')) continue;
          const filePath = path.join(codexSessionsDir, file);
          const fileId = file.replace('.jsonl', '');

          if (fileId === sessionId) {
            await fs.unlink(filePath);
            return { success: true };
          }

          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const firstLine = content.split('\n')[0];
            const meta = JSON.parse(firstLine) as { session_id?: string };
            if (meta.session_id === sessionId) {
              await fs.unlink(filePath);
              return { success: true };
            }
          } catch {
            continue;
          }
        }
      } catch {
        return { success: false, error: 'Session not found' };
      }
      return { success: false, error: 'Session not found' };
    }

    return { success: false, error: 'Unsupported agent type' };
  }

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

  const listModels = os
    .input(
      z.object({
        agentType: z.enum(['claude-code', 'opencode']),
        workspaceName: z.string().optional(),
      })
    )
    .handler(async ({ input }) => {
      const config = ctx.config.get();

      if (input.agentType === 'claude-code') {
        const cached = await ctx.modelCache.getClaudeCodeModels();
        if (cached) {
          return { models: cached };
        }

        const models = await discoverClaudeCodeModels(config);
        await ctx.modelCache.setClaudeCodeModels(models);
        return { models };
      }

      const cached = await ctx.modelCache.getOpencodeModels();
      if (cached) {
        return { models: cached };
      }

      let models;
      if (input.workspaceName === HOST_WORKSPACE_NAME) {
        if (!config.allowHostAccess) {
          throw new ORPCError('PRECONDITION_FAILED', { message: 'Host access is disabled' });
        }
        models = await discoverHostOpencodeModels();
      } else if (input.workspaceName) {
        const workspace = await ctx.workspaces.get(input.workspaceName);
        if (!workspace) {
          throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
        }
        if (workspace.status !== 'running') {
          throw new ORPCError('PRECONDITION_FAILED', { message: 'Workspace is not running' });
        }
        const containerName = `workspace-${input.workspaceName}`;
        models = await discoverContainerOpencodeModels(containerName, execInContainer);
      } else {
        models = await discoverHostOpencodeModels();
        if (models.length === 0) {
          const allWorkspaces = await ctx.workspaces.list();
          const runningWorkspace = allWorkspaces.find((w) => w.status === 'running');
          if (runningWorkspace) {
            const containerName = `workspace-${runningWorkspace.name}`;
            models = await discoverContainerOpencodeModels(containerName, execInContainer);
          }
        }
      }

      if (models.length > 0) {
        await ctx.modelCache.setOpencodeModels(models);
      }
      return { models };
    });

  return {
    workspaces: {
      list: listWorkspaces,
      get: getWorkspace,
      create: createWorkspace,
      clone: cloneWorkspace,
      delete: deleteWorkspace,
      start: startWorkspace,
      stop: stopWorkspace,
      logs: getLogs,
      sync: syncWorkspace,
      syncAll: syncAllWorkspaces,
      touch: touchWorkspace,
      getPortForwards: getPortForwards,
      setPortForwards: setPortForwards,
    },
    sessions: {
      list: listSessions,
      get: getSession,
      rename: renameSession,
      clearName: clearSessionName,
      getRecent: getRecentSessions,
      recordAccess: recordSessionAccess,
      delete: deleteSession,
      search: searchSessions,
    },
    models: {
      list: listModels,
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
      ssh: {
        get: getSSHSettings,
        update: updateSSHSettings,
        listKeys: listSSHKeys,
      },
    },
  };
}

export type AppRouter = ReturnType<typeof createRouter>;
