/**
 * Shared utilities for session management across Claude Code and OpenCode.
 *
 * Provides common functionality for:
 * - Session verification
 * - Session state checking
 * - Session pickup handling
 */

import type { ChatMessage } from './types';

export interface SessionInfo {
  id: string;
  exists: boolean;
  status?: 'idle' | 'busy' | 'unknown';
}

export interface SessionVerificationCallbacks {
  onMessage: (message: ChatMessage) => void;
  onSessionExpired?: () => void;
  onSessionBusy?: () => void;
}

/**
 * Abstract base class for session verification.
 * Subclasses implement the actual verification mechanism.
 */
export abstract class SessionVerifier {
  constructor(protected sessionId: string | undefined) {}

  /**
   * Check if session exists
   */
  abstract verify(): Promise<boolean>;

  /**
   * Get session status (if supported)
   */
  abstract getStatus(): Promise<'idle' | 'busy' | 'unknown'>;

  /**
   * Verify session and notify callbacks about state
   */
  async verifyAndNotify(callbacks: SessionVerificationCallbacks): Promise<boolean> {
    if (!this.sessionId) {
      return true; // No session to verify
    }

    const exists = await this.verify();

    if (!exists) {
      callbacks.onMessage({
        type: 'system',
        content: 'Previous session expired, starting new session...',
        timestamp: new Date().toISOString(),
      });

      if (callbacks.onSessionExpired) {
        callbacks.onSessionExpired();
      }

      return false;
    }

    // Check session status
    const status = await this.getStatus();

    if (status === 'busy') {
      callbacks.onMessage({
        type: 'system',
        content: 'Session is currently busy, waiting for it to become available...',
        timestamp: new Date().toISOString(),
      });

      if (callbacks.onSessionBusy) {
        callbacks.onSessionBusy();
      }
    }

    return true;
  }
}

/**
 * Verifier for OpenCode sessions (uses HTTP API)
 */
export class OpenCodeSessionVerifier extends SessionVerifier {
  constructor(
    sessionId: string | undefined,
    private containerName: string,
    private port: number,
    private execInContainer: (
      container: string,
      command: string[],
      options?: { user?: string }
    ) => Promise<{ stdout: string; exitCode: number }>
  ) {
    super(sessionId);
  }

  async verify(): Promise<boolean> {
    if (!this.sessionId) return true;

    try {
      const result = await this.execInContainer(
        this.containerName,
        [
          'curl',
          '-s',
          '-o',
          '/dev/null',
          '-w',
          '%{http_code}',
          '--max-time',
          '5',
          `http://localhost:${this.port}/session/${this.sessionId}`,
        ],
        { user: 'workspace' }
      );

      return result.stdout.trim() === '200';
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<'idle' | 'busy' | 'unknown'> {
    if (!this.sessionId) return 'unknown';

    try {
      const result = await this.execInContainer(
        this.containerName,
        ['curl', '-s', '--max-time', '5', `http://localhost:${this.port}/session/status`],
        { user: 'workspace' }
      );

      const statuses = JSON.parse(result.stdout);
      const status = statuses[this.sessionId];

      if (status?.type === 'idle') return 'idle';
      if (status?.type === 'busy') return 'busy';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

/**
 * Verifier for Claude Code sessions (filesystem-based)
 */
export class ClaudeCodeSessionVerifier extends SessionVerifier {
  constructor(
    sessionId: string | undefined,
    private checkSessionFile: (sessionId: string) => Promise<boolean>
  ) {
    super(sessionId);
  }

  async verify(): Promise<boolean> {
    if (!this.sessionId) return true;

    try {
      return await this.checkSessionFile(this.sessionId);
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<'idle' | 'busy' | 'unknown'> {
    // Claude Code sessions don't have a "busy" state in the same way
    // They're file-based and managed by the CLI
    return 'unknown';
  }
}

/**
 * Helper to handle session pickup flow consistently
 */
export async function handleSessionPickup(
  verifier: SessionVerifier,
  callbacks: SessionVerificationCallbacks & {
    onNoSession: () => Promise<void>;
  }
): Promise<void> {
  const exists = await verifier.verifyAndNotify(callbacks);

  if (!exists) {
    // Session doesn't exist, need to create new one
    await callbacks.onNoSession();
  }
}

/**
 * Create appropriate session verifier based on session type
 */
export function createSessionVerifier(
  type: 'opencode' | 'claude-code',
  sessionId: string | undefined,
  config: {
    containerName?: string;
    port?: number;
    execInContainer?: (
      container: string,
      command: string[],
      options?: { user?: string }
    ) => Promise<{ stdout: string; exitCode: number }>;
    checkSessionFile?: (sessionId: string) => Promise<boolean>;
  }
): SessionVerifier {
  if (type === 'opencode') {
    if (!config.containerName || !config.port || !config.execInContainer) {
      throw new Error('OpenCode verifier requires containerName, port, and execInContainer');
    }
    return new OpenCodeSessionVerifier(
      sessionId,
      config.containerName,
      config.port,
      config.execInContainer
    );
  } else {
    if (!config.checkSessionFile) {
      throw new Error('Claude Code verifier requires checkSessionFile');
    }
    return new ClaudeCodeSessionVerifier(sessionId, config.checkSessionFile);
  }
}
