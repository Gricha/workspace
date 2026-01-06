import { createServer, IncomingMessage, ServerResponse } from 'http';
import { RPCHandler } from '@orpc/server/node';
import { loadAgentConfig, getConfigDir, ensureConfigDir } from '../config/loader';
import type { AgentConfig } from '../shared/types';
import { HOST_WORKSPACE_NAME } from '../shared/types';
import { DEFAULT_AGENT_PORT } from '../shared/constants';
import { WorkspaceManager } from '../workspace/manager';
import { containerRunning, getContainerName } from '../docker';
import { TerminalWebSocketServer } from '../terminal/websocket';
import { ChatWebSocketServer } from '../chat/websocket';
import { OpencodeWebSocketServer } from '../chat/opencode-websocket';
import { createRouter } from './router';
import { serveStatic } from './static';
import { SessionsCacheManager } from '../sessions/cache';
import pkg from '../../package.json';

const startTime = Date.now();

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function createAgentServer(configDir: string, config: AgentConfig) {
  let currentConfig = config;
  const workspaces = new WorkspaceManager(configDir, currentConfig);
  const sessionsCache = new SessionsCacheManager(configDir);

  const isWorkspaceRunning = async (name: string) => {
    if (name === HOST_WORKSPACE_NAME) {
      return currentConfig.allowHostAccess === true;
    }
    return containerRunning(getContainerName(name));
  };

  const terminalServer = new TerminalWebSocketServer({
    getContainerName,
    isWorkspaceRunning,
    isHostAccessAllowed: () => currentConfig.allowHostAccess === true,
  });

  const chatServer = new ChatWebSocketServer({
    isWorkspaceRunning,
    getConfig: () => currentConfig,
    isHostAccessAllowed: () => currentConfig.allowHostAccess === true,
  });

  const opencodeServer = new OpencodeWebSocketServer({
    isWorkspaceRunning,
    isHostAccessAllowed: () => currentConfig.allowHostAccess === true,
  });

  const router = createRouter({
    workspaces,
    config: {
      get: () => currentConfig,
      set: (newConfig: AgentConfig) => {
        currentConfig = newConfig;
        workspaces.updateConfig(newConfig);
      },
    },
    configDir,
    stateDir: configDir,
    startTime,
    terminalServer,
    sessionsCache,
  });

  const rpcHandler = new RPCHandler(router);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const method = req.method;
    const pathname = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (pathname === '/health' && method === 'GET') {
        sendJson(res, 200, { status: 'ok', version: pkg.version });
        return;
      }

      if (pathname.startsWith('/rpc')) {
        const { matched } = await rpcHandler.handle(req, res, {
          prefix: '/rpc',
        });
        if (matched) return;
      }

      const served = await serveStatic(req, res, pathname);
      if (served) return;

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error('Request error:', err);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  });

  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://localhost');
    const terminalMatch = url.pathname.match(/^\/rpc\/terminal\/([^/]+)$/);
    const chatMatch = url.pathname.match(/^\/rpc\/chat\/([^/]+)$/);
    const opencodeMatch = url.pathname.match(/^\/rpc\/opencode\/([^/]+)$/);

    if (terminalMatch) {
      const workspaceName = decodeURIComponent(terminalMatch[1]);
      await terminalServer.handleUpgrade(request, socket, head, workspaceName);
    } else if (chatMatch) {
      const workspaceName = decodeURIComponent(chatMatch[1]);
      await chatServer.handleUpgrade(request, socket, head, workspaceName);
    } else if (opencodeMatch) {
      const workspaceName = decodeURIComponent(opencodeMatch[1]);
      await opencodeServer.handleUpgrade(request, socket, head, workspaceName);
    } else {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
    }
  });

  return { server, terminalServer, chatServer, opencodeServer };
}

export interface StartAgentOptions {
  port?: number;
  configDir?: string;
  noHostAccess?: boolean;
}

async function getProcessUsingPort(port: number): Promise<string | null> {
  try {
    const proc = Bun.spawn(['lsof', '-i', `:${port}`, '-t'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const output = await new Response(proc.stdout).text();
    const pid = output.trim().split('\n')[0];
    if (!pid) return null;

    const psProc = Bun.spawn(['ps', '-p', pid, '-o', 'pid=,comm=,args='], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const psOutput = await new Response(psProc.stdout).text();
    return psOutput.trim() || `PID ${pid}`;
  } catch {
    return null;
  }
}

export async function startAgent(options: StartAgentOptions = {}): Promise<void> {
  const configDir = options.configDir || getConfigDir();

  await ensureConfigDir(configDir);

  const config = await loadAgentConfig(configDir);

  if (options.noHostAccess || process.env.PERRY_NO_HOST_ACCESS === 'true') {
    config.allowHostAccess = false;
  }

  const port =
    options.port || parseInt(process.env.PERRY_PORT || '', 10) || config.port || DEFAULT_AGENT_PORT;

  console.log(`[agent] Config directory: ${configDir}`);
  console.log(`[agent] Starting on port ${port}...`);

  const { server, terminalServer, chatServer, opencodeServer } = createAgentServer(
    configDir,
    config
  );

  server.on('error', async (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[agent] Error: Port ${port} is already in use.`);
      const processInfo = await getProcessUsingPort(port);
      if (processInfo) {
        console.error(`[agent] Process using port: ${processInfo}`);
      }
      console.error(`[agent] Try using a different port with: perry agent run --port <port>`);
      process.exit(1);
    } else {
      console.error(`[agent] Server error: ${err.message}`);
      process.exit(1);
    }
  });

  server.listen(port, '::', () => {
    console.log(`[agent] Agent running at http://localhost:${port}`);
    console.log(`[agent] oRPC endpoint: http://localhost:${port}/rpc`);
    console.log(`[agent] WebSocket terminal: ws://localhost:${port}/rpc/terminal/:name`);
    console.log(`[agent] WebSocket chat (Claude): ws://localhost:${port}/rpc/chat/:name`);
    console.log(`[agent] WebSocket chat (OpenCode): ws://localhost:${port}/rpc/opencode/:name`);
  });

  const shutdown = () => {
    console.log('[agent] Shutting down...');
    chatServer.close();
    opencodeServer.close();
    terminalServer.close();
    server.close(() => {
      console.log('[agent] Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return new Promise(() => {});
}
