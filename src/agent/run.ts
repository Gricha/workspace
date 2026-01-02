import { createServer, IncomingMessage, ServerResponse } from 'http';
import { RPCHandler } from '@orpc/server/node';
import { loadAgentConfig, getConfigDir, ensureConfigDir } from '../config/loader';
import { DEFAULT_PORT, type AgentConfig } from '../shared/types';
import { WorkspaceManager } from '../workspace/manager';
import { containerRunning } from '../docker';
import { TerminalWebSocketServer } from '../terminal/websocket';
import { createRouter } from './router';
import { serveStatic } from './static';

const startTime = Date.now();
const CONTAINER_PREFIX = 'workspace-';

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function createAgentServer(configDir: string, config: AgentConfig) {
  let currentConfig = config;
  const workspaces = new WorkspaceManager(configDir, currentConfig);

  const terminalServer = new TerminalWebSocketServer({
    getContainerName: (name) => `${CONTAINER_PREFIX}${name}`,
    isWorkspaceRunning: async (name) => {
      const containerName = `${CONTAINER_PREFIX}${name}`;
      return containerRunning(containerName);
    },
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
    startTime,
    terminalServer,
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
        sendJson(res, 200, { status: 'ok', version: '2.0.0' });
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

    if (terminalMatch) {
      const workspaceName = decodeURIComponent(terminalMatch[1]);
      await terminalServer.handleUpgrade(request, socket, head, workspaceName);
    } else {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
    }
  });

  return { server, terminalServer };
}

export interface StartAgentOptions {
  port?: number;
  configDir?: string;
}

export async function startAgent(options: StartAgentOptions = {}): Promise<void> {
  const configDir = options.configDir || getConfigDir();

  await ensureConfigDir(configDir);

  const config = await loadAgentConfig(configDir);
  const port =
    options.port || parseInt(process.env.WS_PORT || '', 10) || config.port || DEFAULT_PORT;

  console.log(`[agent] Config directory: ${configDir}`);
  console.log(`[agent] Starting on port ${port}...`);

  const { server, terminalServer } = createAgentServer(configDir, config);

  server.listen(port, '::', () => {
    console.log(`[agent] Agent running at http://localhost:${port}`);
    console.log(`[agent] oRPC endpoint: http://localhost:${port}/rpc`);
    console.log(`[agent] WebSocket terminal: ws://localhost:${port}/rpc/terminal/:name`);
  });

  const shutdown = () => {
    console.log('[agent] Shutting down...');
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
