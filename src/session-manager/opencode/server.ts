import type { Subprocess } from 'bun';
import { execInContainer } from '../../docker';

export interface EnsureOpenCodeServerOptions {
  isHost: boolean;
  containerName?: string;
  projectPath?: string;
  hostname?: string;
  auth?: {
    username?: string;
    password?: string;
  };
}

const serverPorts = new Map<string, number>();
const serverStarting = new Map<string, Promise<number>>();

const hostServerPorts = new Map<string, number>();
const hostServerStarting = new Map<string, Promise<number>>();
const hostServerProcesses = new Map<string, Subprocess<'ignore', 'pipe', 'pipe'>>();

function getServerKey(containerName: string, projectPath?: string): string {
  return `${containerName}:${projectPath ?? ''}`;
}

async function findAvailablePort(containerName: string): Promise<number> {
  const script = `import socket; s=socket.socket(); s.bind(('', 0)); print(s.getsockname()[1]); s.close()`;
  const result = await execInContainer(containerName, ['python3', '-c', script], {
    user: 'workspace',
  });
  return parseInt(result.stdout.trim(), 10);
}

async function isServerRunning(containerName: string, port: number): Promise<boolean> {
  try {
    const result = await execInContainer(
      containerName,
      [
        'curl',
        '-s',
        '-o',
        '/dev/null',
        '-w',
        '%{http_code}',
        '--max-time',
        '3',
        `http://localhost:${port}/session`,
      ],
      { user: 'workspace' }
    );
    return result.stdout.trim() === '200';
  } catch {
    return false;
  }
}

async function findExistingServer(containerName: string): Promise<number | null> {
  try {
    const result = await execInContainer(
      containerName,
      ['sh', '-c', 'pgrep -a -f "opencode serve" | grep -oP "\\--port \\K[0-9]+"'],
      { user: 'workspace' }
    );
    const ports = result.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((p) => parseInt(p, 10))
      .filter((p) => !isNaN(p));

    for (const port of ports) {
      if (await isServerRunning(containerName, port)) {
        return port;
      }
    }
  } catch {
    // No existing server
  }
  return null;
}

async function getServerLogs(containerName: string): Promise<string> {
  try {
    const result = await execInContainer(
      containerName,
      ['tail', '-20', '/tmp/opencode-server.log'],
      {
        user: 'workspace',
      }
    );
    return result.stdout;
  } catch {
    return '(no logs available)';
  }
}

async function ensureContainerServer(
  containerName: string,
  options: {
    projectPath?: string;
    hostname?: string;
    auth?: { username?: string; password?: string };
  }
): Promise<number> {
  const projectPath = options.projectPath;
  const hostname = options.hostname ?? '0.0.0.0';
  const auth = options.auth;

  // hostname/auth used when spawning server (below)
  const key = getServerKey(containerName, projectPath);

  const cached = serverPorts.get(key);
  if (cached && (await isServerRunning(containerName, cached))) {
    return cached;
  }

  if (!projectPath) {
    const existing = await findExistingServer(containerName);
    if (existing) {
      console.log(`[opencode] Found existing server on port ${existing} in ${containerName}`);
      serverPorts.set(key, existing);
      return existing;
    }
  }

  const starting = serverStarting.get(key);
  if (starting) {
    return starting;
  }

  const startPromise = (async () => {
    const port = await findAvailablePort(containerName);
    console.log(
      `[opencode] Starting server on port ${port} in ${containerName}${projectPath ? ` (cwd ${projectPath})` : ''}`
    );

    await execInContainer(
      containerName,
      [
        'sh',
        '-c',
        // Use positional parameters to avoid shell interpolation of hostname.
        // $1=port, $2=hostname
        'nohup opencode serve --port "$1" --hostname "$2" > /tmp/opencode-server.log 2>&1 &',
        'opencode',
        String(port),
        hostname,
      ],
      {
        user: 'workspace',
        workdir: projectPath,
        env: {
          ...(auth?.password ? { OPENCODE_SERVER_PASSWORD: auth.password } : {}),
          ...(auth?.username ? { OPENCODE_SERVER_USERNAME: auth.username } : {}),
        },
      }
    );

    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (await isServerRunning(containerName, port)) {
        console.log(`[opencode] Server ready on port ${port}`);
        serverPorts.set(key, port);
        serverStarting.delete(key);
        return port;
      }
    }

    serverStarting.delete(key);
    const logs = await getServerLogs(containerName);
    throw new Error(`Failed to start OpenCode server. Logs:\n${logs}`);
  })();

  serverStarting.set(key, startPromise);
  return startPromise;
}

async function findAvailablePortHost(): Promise<number> {
  const server = Bun.serve({
    port: 0,
    fetch: () => new Response(''),
  });
  const port = server.port!;
  await server.stop();
  return port;
}

async function isServerRunningHost(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/session`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureHostServer(options: {
  projectPath?: string;
  hostname?: string;
  auth?: { username?: string; password?: string };
}): Promise<number> {
  const projectPath = options.projectPath;
  const hostname = options.hostname ?? '0.0.0.0';
  const auth = options.auth;

  // hostname/auth used when spawning server (below)
  const key = projectPath ?? '';

  const cached = hostServerPorts.get(key);
  if (cached && (await isServerRunningHost(cached))) {
    return cached;
  }

  const starting = hostServerStarting.get(key);
  if (starting) {
    return starting;
  }

  const startPromise = (async () => {
    const port = await findAvailablePortHost();

    console.log(
      `[opencode] Starting server on port ${port} on host${projectPath ? ` (cwd ${projectPath})` : ''}`
    );

    const proc = Bun.spawn(['opencode', 'serve', '--port', String(port), '--hostname', hostname], {
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      cwd: projectPath,
      env: {
        ...process.env,
        ...(auth?.password ? { OPENCODE_SERVER_PASSWORD: auth.password } : {}),
        ...(auth?.username ? { OPENCODE_SERVER_USERNAME: auth.username } : {}),
      },
    });

    hostServerProcesses.set(key, proc);

    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (await isServerRunningHost(port)) {
        console.log(`[opencode] Server ready on port ${port}`);
        hostServerPorts.set(key, port);
        hostServerStarting.delete(key);
        return port;
      }
    }

    hostServerStarting.delete(key);
    const running = hostServerProcesses.get(key);
    if (running) {
      running.kill();
      await running.exited;
      hostServerProcesses.delete(key);
    }

    throw new Error('Failed to start OpenCode server on host');
  })();

  hostServerStarting.set(key, startPromise);
  return startPromise;
}

export async function ensureOpenCodeServer(options: EnsureOpenCodeServerOptions): Promise<number> {
  if (options.isHost) {
    return ensureHostServer({
      projectPath: options.projectPath,
      hostname: options.hostname,
      auth: options.auth,
    });
  }

  if (!options.containerName) {
    throw new Error('containerName is required when isHost=false');
  }

  return ensureContainerServer(options.containerName, {
    projectPath: options.projectPath,
    hostname: options.hostname,
    auth: options.auth,
  });
}
