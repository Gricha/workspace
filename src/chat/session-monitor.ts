/**
 * Shared session monitoring and error handling for both Claude Code and OpenCode sessions.
 *
 * This module provides common functionality:
 * - Activity/heartbeat monitoring
 * - Timeout handling with user-friendly messages
 * - Session state management
 * - Error message formatting
 */

import type { ChatMessage } from './types';

export interface SessionMonitorConfig {
  /** Timeout for overall operation (ms) */
  operationTimeout: number;
  /** Timeout for receiving initial response (ms) */
  initialResponseTimeout: number;
  /** Timeout for activity/heartbeat (0 = disabled) */
  activityTimeout?: number;
  /** Name of the operation for error messages */
  operationName: string;
}

export interface SessionMonitorCallbacks {
  onError: (message: ChatMessage) => void;
  onTimeout: () => void;
  onActivityTimeout?: () => void;
}

/**
 * Monitors a session for timeouts and activity.
 * Handles cleanup of timers automatically.
 */
export class SessionMonitor {
  private operationTimer: ReturnType<typeof setTimeout> | null = null;
  private initialResponseTimer: ReturnType<typeof setTimeout> | null = null;
  private activityTimer: ReturnType<typeof setInterval> | null = null;
  private lastActivity: number = 0;
  private started = false;
  private completed = false;

  constructor(
    private config: SessionMonitorConfig,
    private callbacks: SessionMonitorCallbacks
  ) {}

  /**
   * Start monitoring the session
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    // Set up initial response timeout
    this.initialResponseTimer = setTimeout(() => {
      if (!this.completed && this.lastActivity === 0) {
        this.handleTimeout('No response received from server');
      }
    }, this.config.initialResponseTimeout);

    // Set up overall operation timeout
    this.operationTimer = setTimeout(() => {
      if (!this.completed) {
        this.handleTimeout(
          `Request timed out after ${this.config.operationTimeout / 1000}s. The operation took too long to complete.`
        );
      }
    }, this.config.operationTimeout);

    // Set up activity monitoring if configured
    if (this.config.activityTimeout && this.config.activityTimeout > 0) {
      this.activityTimer = setInterval(() => {
        const timeSinceActivity = Date.now() - this.lastActivity;
        if (timeSinceActivity > this.config.activityTimeout! && !this.completed) {
          this.handleActivityTimeout();
        }
      }, this.config.activityTimeout / 2);
    }
  }

  /**
   * Mark that we received activity (data, heartbeat, etc.)
   */
  markActivity(): void {
    this.lastActivity = Date.now();

    // Cancel initial response timeout once we receive first data
    if (this.initialResponseTimer) {
      clearTimeout(this.initialResponseTimer);
      this.initialResponseTimer = null;
    }
  }

  /**
   * Mark the operation as complete and clean up
   */
  complete(): void {
    this.completed = true;
    this.cleanup();
  }

  /**
   * Clean up all timers
   */
  cleanup(): void {
    if (this.operationTimer) {
      clearTimeout(this.operationTimer);
      this.operationTimer = null;
    }
    if (this.initialResponseTimer) {
      clearTimeout(this.initialResponseTimer);
      this.initialResponseTimer = null;
    }
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }
  }

  /**
   * Check if the monitor has been completed
   */
  isCompleted(): boolean {
    return this.completed;
  }

  private handleTimeout(message: string): void {
    this.completed = true;
    this.callbacks.onError({
      type: 'error',
      content: `${message} Please try again or check if ${this.config.operationName} is responding.`,
      timestamp: new Date().toISOString(),
    });
    this.callbacks.onTimeout();
    this.cleanup();
  }

  private handleActivityTimeout(): void {
    this.completed = true;
    this.callbacks.onError({
      type: 'error',
      content: `Connection to ${this.config.operationName} lost. Please try again.`,
      timestamp: new Date().toISOString(),
    });
    if (this.callbacks.onActivityTimeout) {
      this.callbacks.onActivityTimeout();
    }
    this.cleanup();
  }
}

/**
 * Validates and formats error messages to be user-friendly
 */
export function formatErrorMessage(error: unknown, context: string): string {
  if (error instanceof Error) {
    // Remove stack traces and internal error patterns
    let message = error.message || '';

    // Common patterns to clean up
    const cleanPatterns = [
      /\s+at\s+.*/g, // Stack traces
      /Error:\s+/g, // Redundant "Error: " prefix
      /TypeError:\s+/g,
      /ReferenceError:\s+/g,
    ];

    for (const pattern of cleanPatterns) {
      message = message.replace(pattern, '');
    }

    message = message.trim();

    // If message is too technical or empty, provide a generic message
    if (!message || message.length < 5 || message.includes('undefined')) {
      return `${context} failed. Please try again.`;
    }

    // Ensure first letter is capitalized
    message = message.charAt(0).toUpperCase() + message.slice(1);

    // Ensure it ends with punctuation
    if (!/[.!?]$/.test(message)) {
      message += '.';
    }

    return message;
  }

  return `${context} failed. Please try again.`;
}

/**
 * Wraps an async operation with timeout and error handling
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([operation, timeout]);
}

/**
 * Configuration presets for different session types
 */
export const MONITOR_PRESETS = {
  // For Claude Code CLI sessions (simpler, no heartbeat)
  claudeCode: {
    operationTimeout: 300000, // 5 minutes for long operations
    initialResponseTimeout: 10000, // 10 seconds to start responding
    activityTimeout: 0, // Disabled - subprocess output is continuous
    operationName: 'Claude Code',
  } as SessionMonitorConfig,

  // For OpenCode HTTP/SSE sessions (needs heartbeat monitoring)
  openCode: {
    operationTimeout: 120000, // 2 minutes
    initialResponseTimeout: 5000, // 5 seconds to connect
    activityTimeout: 45000, // 45 seconds (OpenCode heartbeats every 30s)
    operationName: 'OpenCode',
  } as SessionMonitorConfig,

  // For quick operations (health checks, session verification)
  quick: {
    operationTimeout: 10000, // 10 seconds
    initialResponseTimeout: 5000, // 5 seconds
    activityTimeout: 0,
    operationName: 'Operation',
  } as SessionMonitorConfig,
};
