import WebSocket from 'ws';
import type { ControlMessage } from '../terminal/types';

export interface ShellOptions {
  terminalUrl: string;
  onConnect?: () => void;
  onDisconnect?: (code: number) => void;
  onError?: (error: Error) => void;
}

export async function openShell(options: ShellOptions): Promise<void> {
  const { terminalUrl, onConnect, onDisconnect, onError } = options;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(terminalUrl);

    let connected = false;
    let originalStdinRawMode: boolean | undefined;
    let cleanedUp = false;

    const cleanup = (exitCode = 0) => {
      if (cleanedUp) return;
      cleanedUp = true;

      if (originalStdinRawMode !== undefined && process.stdin.isTTY) {
        process.stdin.setRawMode(originalStdinRawMode);
      }
      process.stdin.removeAllListeners('data');
      process.removeAllListeners('SIGWINCH');

      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }

      if (onDisconnect) {
        onDisconnect(exitCode);
      }

      resolve();
    };

    const sendResize = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!process.stdout.isTTY) return;

      const resizeMessage: ControlMessage = {
        type: 'resize',
        cols: process.stdout.columns || 80,
        rows: process.stdout.rows || 24,
      };
      ws.send(JSON.stringify(resizeMessage));
    };

    ws.on('open', () => {
      connected = true;

      if (process.stdin.isTTY) {
        originalStdinRawMode = process.stdin.isRaw;
        process.stdin.setRawMode(true);
      }

      process.stdin.on('data', (data: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      process.on('SIGWINCH', sendResize);

      sendResize();

      if (onConnect) {
        onConnect();
      }
    });

    ws.on('message', (data: Buffer | string) => {
      process.stdout.write(data);
    });

    ws.on('close', (code) => {
      cleanup(code === 1000 ? 0 : 1);
    });

    ws.on('error', (err) => {
      if (!connected) {
        reject(err);
        return;
      }

      if (onError) {
        onError(err);
      }
      cleanup(1);
    });

    ws.on('unexpected-response', (_req, res) => {
      const statusCode = res.statusCode || 0;
      let errorMessage = `Connection failed with status ${statusCode}`;

      if (statusCode === 404) {
        errorMessage = 'Workspace not found or not running';
      } else if (statusCode === 503) {
        errorMessage = 'Workspace is not running';
      }

      reject(new Error(errorMessage));
    });

    process.stdin.on('end', () => {
      cleanup(0);
    });
  });
}
