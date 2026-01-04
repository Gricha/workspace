import { spawn } from 'child_process';

export interface SSHShellOptions {
  worker: string;
  sshPort: number;
  user?: string;
  onConnect?: () => void;
  onDisconnect?: (code: number) => void;
  onError?: (error: Error) => void;
}

function extractHost(worker: string): string {
  let host = worker;
  if (host.startsWith('http://')) {
    host = host.slice(7);
  } else if (host.startsWith('https://')) {
    host = host.slice(8);
  }
  if (host.includes(':')) {
    host = host.split(':')[0];
  }
  return host;
}

export async function openSSHShell(options: SSHShellOptions): Promise<void> {
  const { worker, sshPort, user = 'workspace', onConnect, onDisconnect, onError } = options;
  const host = extractHost(worker);

  return new Promise((resolve, reject) => {
    const sshArgs: string[] = [
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'UserKnownHostsFile=/dev/null',
      '-o',
      'LogLevel=ERROR',
      '-p',
      String(sshPort),
      `${user}@${host}`,
    ];

    const proc = spawn('ssh', sshArgs, {
      stdio: 'inherit',
    });

    let connected = false;

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
    }, 500);

    proc.on('error', (err) => {
      clearTimeout(connectionTimeout);
      if (!connected) {
        reject(err);
      } else if (onError) {
        onError(err);
      }
    });

    proc.on('close', (code) => {
      clearTimeout(connectionTimeout);
      if (!connected && code !== 0) {
        reject(new Error(`SSH failed with exit code ${code}`));
      } else {
        if (onDisconnect) {
          onDisconnect(code || 0);
        }
        resolve();
      }
    });
  });
}
