import { spawn } from 'child_process';
import type { PortForward } from './port-forward';
import { parsePortForward, formatPortForwards } from './port-forward';

export { PortForward, parsePortForward, formatPortForwards };

export interface ProxyOptions {
  worker: string;
  sshPort: number;
  forwards: PortForward[];
  user?: string;
  onConnect?: () => void;
  onDisconnect?: (code: number) => void;
  onError?: (error: Error) => void;
}

export async function startProxy(options: ProxyOptions): Promise<void> {
  const {
    worker,
    sshPort,
    forwards,
    user = 'workspace',
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const workerHost = worker.includes(':') ? worker.split(':')[0] : worker;

  return new Promise((resolve, reject) => {
    const sshArgs: string[] = [
      '-N',
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'UserKnownHostsFile=/dev/null',
      '-o',
      'LogLevel=ERROR',
      '-o',
      'ServerAliveInterval=60',
      '-o',
      'ServerAliveCountMax=3',
      '-p',
      String(sshPort),
    ];

    for (const fwd of forwards) {
      sshArgs.push('-L', `${fwd.localPort}:localhost:${fwd.remotePort}`);
    }

    sshArgs.push(`${user}@${workerHost}`);

    const proc = spawn('ssh', sshArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let connected = false;
    let errorOutput = '';

    proc.stderr?.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    const connectionTimeout = setTimeout(() => {
      if (!connected) {
        proc.kill();
        reject(new Error('SSH connection timeout'));
      }
    }, 30000);

    setTimeout(() => {
      if (proc.exitCode === null) {
        connected = true;
        clearTimeout(connectionTimeout);
        if (onConnect) {
          onConnect();
        }
      }
    }, 2000);

    proc.on('error', (err) => {
      clearTimeout(connectionTimeout);
      if (!connected) {
        reject(err);
      } else if (onError) {
        onError(err);
      }
    });

    const cleanup = () => {
      process.removeListener('SIGINT', handleSignal);
      process.removeListener('SIGTERM', handleSignal);
    };

    const handleSignal = () => {
      proc.kill('SIGTERM');
    };

    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);

    proc.on('close', (code) => {
      clearTimeout(connectionTimeout);
      cleanup();
      if (!connected) {
        reject(new Error(`SSH failed: ${errorOutput || `exit code ${code}`}`));
      } else {
        if (onDisconnect) {
          onDisconnect(code || 0);
        }
        resolve();
      }
    });
  });
}
