import { os, ORPCError } from '@orpc/server';
import * as z from 'zod';
import os_module from 'os';
import { type AgentConfig } from '../shared/types';
import { getDockerVersion } from '../docker';
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

export interface RouterContext {
  workspaces: WorkspaceManager;
  config: { get: () => AgentConfig; set: (config: AgentConfig) => void };
  configDir: string;
  startTime: number;
  terminalServer: TerminalWebSocketServer;
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
        const message = err instanceof Error ? err.message : 'Failed to create workspace';
        if (message.includes('already exists')) {
          throw new ORPCError('CONFLICT', { message });
        }
        if (message.includes('not found')) {
          throw new ORPCError('BAD_REQUEST', { message });
        }
        throw new ORPCError('INTERNAL_SERVER_ERROR', { message });
      }
    });

  const deleteWorkspace = os.input(z.object({ name: z.string() })).handler(async ({ input }) => {
    try {
      ctx.terminalServer.closeConnectionsForWorkspace(input.name);
      await ctx.workspaces.delete(input.name);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete workspace';
      if (message.includes('not found')) {
        throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
      }
      throw new ORPCError('INTERNAL_SERVER_ERROR', { message });
    }
  });

  const startWorkspace = os
    .input(z.object({ name: z.string() }))
    .output(WorkspaceInfoSchema)
    .handler(async ({ input }) => {
      try {
        return await ctx.workspaces.start(input.name);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start workspace';
        if (message.includes('not found')) {
          throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
        }
        throw new ORPCError('INTERNAL_SERVER_ERROR', { message });
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
        const message = err instanceof Error ? err.message : 'Failed to stop workspace';
        if (message.includes('not found')) {
          throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
        }
        throw new ORPCError('INTERNAL_SERVER_ERROR', { message });
      }
    });

  const getLogs = os
    .input(z.object({ name: z.string(), tail: z.number().optional().default(100) }))
    .handler(async ({ input }) => {
      try {
        return await ctx.workspaces.getLogs(input.name, input.tail);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get logs';
        if (message.includes('not found')) {
          throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
        }
        throw new ORPCError('INTERNAL_SERVER_ERROR', { message });
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
    },
  };
}

export type AppRouter = ReturnType<typeof createRouter>;
