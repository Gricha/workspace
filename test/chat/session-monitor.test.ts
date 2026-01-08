import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import {
  SessionMonitor,
  MONITOR_PRESETS,
  formatErrorMessage,
  withTimeout,
} from '../../src/chat/session-monitor';
import type { ChatMessage } from '../../src/chat/types';

describe('SessionMonitor', () => {
  let errorMessages: ChatMessage[] = [];
  let timeoutCalled = false;
  let activityTimeoutCalled = false;

  beforeEach(() => {
    errorMessages = [];
    timeoutCalled = false;
    activityTimeoutCalled = false;
  });

  afterEach(async () => {
    // Give timers time to clean up
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  test('should mark activity and not timeout', async () => {
    const monitor = new SessionMonitor(
      {
        operationTimeout: 1000,
        initialResponseTimeout: 200,
        activityTimeout: 300,
        operationName: 'Test',
      },
      {
        onError: (msg) => errorMessages.push(msg),
        onTimeout: () => {
          timeoutCalled = true;
        },
        onActivityTimeout: () => {
          activityTimeoutCalled = true;
        },
      }
    );

    monitor.start();

    // Mark activity multiple times
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      monitor.markActivity();
    }

    monitor.complete();

    expect(errorMessages).toHaveLength(0);
    expect(timeoutCalled).toBe(false);
    expect(activityTimeoutCalled).toBe(false);
  });

  test('should timeout if no initial response', async () => {
    const monitor = new SessionMonitor(
      {
        operationTimeout: 5000,
        initialResponseTimeout: 100,
        activityTimeout: 0,
        operationName: 'Test',
      },
      {
        onError: (msg) => errorMessages.push(msg),
        onTimeout: () => {
          timeoutCalled = true;
        },
      }
    );

    monitor.start();

    // Wait for initial timeout plus buffer
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(errorMessages.length).toBeGreaterThanOrEqual(1);
    expect(errorMessages[0].type).toBe('error');
    expect(errorMessages[0].content).toContain('No response');
    expect(timeoutCalled).toBe(true);
  });

  test('should timeout on activity timeout', async () => {
    const monitor = new SessionMonitor(
      {
        operationTimeout: 5000,
        initialResponseTimeout: 50,
        activityTimeout: 200,
        operationName: 'Test',
      },
      {
        onError: (msg) => errorMessages.push(msg),
        onTimeout: () => {
          timeoutCalled = true;
        },
        onActivityTimeout: () => {
          activityTimeoutCalled = true;
        },
      }
    );

    monitor.start();

    // Mark initial activity to pass initial timeout
    monitor.markActivity();

    // Wait longer than activity timeout without marking activity
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(errorMessages.length).toBeGreaterThanOrEqual(1);
    expect(errorMessages[0].type).toBe('error');
    expect(errorMessages[0].content).toContain('lost');
    expect(activityTimeoutCalled).toBe(true);
  });

  test('should timeout on overall operation timeout', async () => {
    const monitor = new SessionMonitor(
      {
        operationTimeout: 200,
        initialResponseTimeout: 50,
        activityTimeout: 0,
        operationName: 'Test',
      },
      {
        onError: (msg) => errorMessages.push(msg),
        onTimeout: () => {
          timeoutCalled = true;
        },
      }
    );

    monitor.start();
    monitor.markActivity(); // Start the operation

    // Keep marking activity but exceed overall timeout
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      monitor.markActivity();
    }

    expect(errorMessages).toHaveLength(1);
    expect(errorMessages[0].type).toBe('error');
    expect(errorMessages[0].content).toContain('timed out');
    expect(timeoutCalled).toBe(true);
  });

  test('should not fire timeout after complete', async () => {
    const monitor = new SessionMonitor(
      {
        operationTimeout: 200,
        initialResponseTimeout: 100,
        activityTimeout: 0,
        operationName: 'Test',
      },
      {
        onError: (msg) => errorMessages.push(msg),
        onTimeout: () => {
          timeoutCalled = true;
        },
      }
    );

    monitor.start();
    monitor.markActivity();
    monitor.complete();

    // Wait to ensure no timeouts fire
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(errorMessages).toHaveLength(0);
    expect(timeoutCalled).toBe(false);
  });

  test('should handle double start gracefully', () => {
    const monitor = new SessionMonitor(MONITOR_PRESETS.quick, {
      onError: (msg) => errorMessages.push(msg),
      onTimeout: () => {
        timeoutCalled = true;
      },
    });

    monitor.start();
    monitor.start(); // Should be no-op

    monitor.complete();

    expect(errorMessages).toHaveLength(0);
  });

  test('should handle double complete gracefully', async () => {
    const monitor = new SessionMonitor(MONITOR_PRESETS.quick, {
      onError: (msg) => errorMessages.push(msg),
      onTimeout: () => {
        timeoutCalled = true;
      },
    });

    monitor.start();
    monitor.markActivity();
    monitor.complete();
    monitor.complete(); // Should be no-op

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(errorMessages).toHaveLength(0);
  });

  test('isCompleted should reflect monitor state', () => {
    const monitor = new SessionMonitor(MONITOR_PRESETS.quick, {
      onError: (msg) => errorMessages.push(msg),
      onTimeout: () => {
        timeoutCalled = true;
      },
    });

    expect(monitor.isCompleted()).toBe(false);

    monitor.start();
    expect(monitor.isCompleted()).toBe(false);

    monitor.markActivity();
    expect(monitor.isCompleted()).toBe(false);

    monitor.complete();
    expect(monitor.isCompleted()).toBe(true);
  });

  test('cleanup should be called on timeout', async () => {
    const monitor = new SessionMonitor(
      {
        operationTimeout: 5000,
        initialResponseTimeout: 50,
        activityTimeout: 0,
        operationName: 'Test',
      },
      {
        onError: (msg) => errorMessages.push(msg),
        onTimeout: () => {
          timeoutCalled = true;
        },
      }
    );

    monitor.start();

    // Wait for initial timeout plus buffer
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(monitor.isCompleted()).toBe(true);
    expect(timeoutCalled).toBe(true);

    // Cleanup should have been called, so double complete is safe
    monitor.complete();
  });
});

describe('MONITOR_PRESETS', () => {
  test('claudeCode preset has reasonable values', () => {
    const preset = MONITOR_PRESETS.claudeCode;

    expect(preset.operationTimeout).toBeGreaterThan(0);
    expect(preset.initialResponseTimeout).toBeGreaterThan(0);
    expect(preset.initialResponseTimeout).toBeLessThan(preset.operationTimeout);
    expect(preset.operationName).toBe('Claude Code');
  });

  test('openCode preset has reasonable values', () => {
    const preset = MONITOR_PRESETS.openCode;

    expect(preset.operationTimeout).toBeGreaterThan(0);
    expect(preset.initialResponseTimeout).toBeGreaterThan(0);
    expect(preset.activityTimeout).toBeGreaterThan(0);
    expect(preset.initialResponseTimeout).toBeLessThan(preset.operationTimeout);
    expect(preset.operationName).toBe('OpenCode');
  });

  test('quick preset has reasonable values', () => {
    const preset = MONITOR_PRESETS.quick;

    expect(preset.operationTimeout).toBeGreaterThan(0);
    expect(preset.initialResponseTimeout).toBeGreaterThan(0);
    expect(preset.activityTimeout).toBe(0);
    expect(preset.initialResponseTimeout).toBeLessThan(preset.operationTimeout);
    expect(preset.operationName).toBe('Operation');
  });
});

describe('formatErrorMessage', () => {
  test('should format Error objects', () => {
    const error = new Error('Test error message');
    const formatted = formatErrorMessage(error, 'Test Operation');

    expect(formatted).toContain('Test error message');
    expect(formatted).not.toContain('Error:');
    expect(formatted).not.toContain('at ');
    expect(formatted.charAt(0)).toBe(formatted.charAt(0).toUpperCase());
  });

  test('should remove stack traces', () => {
    const error = new Error('Test error\n    at Object.<anonymous>\n    at Module._compile');
    const formatted = formatErrorMessage(error, 'Test Operation');

    expect(formatted).not.toContain('at Object');
    expect(formatted).not.toContain('at Module');
  });

  test('should handle TypeError', () => {
    const formatted = formatErrorMessage(new TypeError('Cannot read property'), 'Test Operation');

    expect(formatted).not.toContain('TypeError:');
    expect(formatted).toContain('Cannot read property');
  });

  test('should handle empty messages', () => {
    const error = new Error('');
    const formatted = formatErrorMessage(error, 'Test Operation');

    expect(formatted).toBe('Test Operation failed. Please try again.');
  });

  test('should handle undefined messages', () => {
    const error = new Error();
    error.message = undefined as any;
    const formatted = formatErrorMessage(error, 'Test Operation');

    expect(formatted).toContain('failed');
  });

  test('should handle non-Error objects', () => {
    const formatted = formatErrorMessage('string error', 'Test Operation');

    expect(formatted).toBe('Test Operation failed. Please try again.');
  });

  test('should capitalize first letter', () => {
    const error = new Error('test message');
    const formatted = formatErrorMessage(error, 'Test Operation');

    expect(formatted.charAt(0)).toBe('T');
  });

  test('should add punctuation', () => {
    const error = new Error('test message');
    const formatted = formatErrorMessage(error, 'Test Operation');

    expect(formatted.endsWith('.')).toBe(true);
  });

  test('should not add duplicate punctuation', () => {
    const error = new Error('test message.');
    const formatted = formatErrorMessage(error, 'Test Operation');

    expect(formatted).toBe('Test message.');
  });
});

describe('withTimeout', () => {
  test('should resolve if operation completes before timeout', async () => {
    const operation = new Promise<string>((resolve) => {
      setTimeout(() => resolve('success'), 50);
    });

    const result = await withTimeout(operation, 200, 'Timeout');

    expect(result).toBe('success');
  });

  test('should reject if operation exceeds timeout', async () => {
    const operation = new Promise<string>((resolve) => {
      setTimeout(() => resolve('success'), 200);
    });

    try {
      await withTimeout(operation, 50, 'Timeout message');
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect((err as Error).message).toBe('Timeout message');
    }
  });

  test('should reject if operation rejects', async () => {
    const operation = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Operation failed')), 50);
    });

    try {
      await withTimeout(operation, 200, 'Timeout message');
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect((err as Error).message).toBe('Operation failed');
    }
  });

  test('should handle immediate resolution', async () => {
    const operation = Promise.resolve('immediate');

    const result = await withTimeout(operation, 100, 'Timeout');

    expect(result).toBe('immediate');
  });

  test('should handle immediate rejection', async () => {
    const operation = Promise.reject(new Error('immediate error'));

    try {
      await withTimeout(operation, 100, 'Timeout');
      expect(true).toBe(false);
    } catch (err) {
      expect((err as Error).message).toBe('immediate error');
    }
  });
});
