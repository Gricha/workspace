import { describe, expect, test, mock } from 'bun:test';
import {
  OpenCodeSessionVerifier,
  ClaudeCodeSessionVerifier,
  createSessionVerifier,
  handleSessionPickup,
} from '../../src/chat/session-utils';
import type { ChatMessage } from '../../src/chat/types';

describe('OpenCodeSessionVerifier', () => {
  test('should verify existing session', async () => {
    const mockExec = mock(async () => ({
      stdout: '200',
      exitCode: 0,
    }));

    const verifier = new OpenCodeSessionVerifier(
      'test-session-id',
      'test-container',
      8080,
      mockExec
    );

    const result = await verifier.verify();

    expect(result).toBe(true);
    expect(mockExec).toHaveBeenCalledTimes(1);
    expect(mockExec.mock.calls[0][1]).toContain('curl');
    expect(mockExec.mock.calls[0][1]).toContain('http://localhost:8080/session/test-session-id');
  });

  test('should return false for non-existent session', async () => {
    const mockExec = mock(async () => ({
      stdout: '404',
      exitCode: 0,
    }));

    const verifier = new OpenCodeSessionVerifier(
      'test-session-id',
      'test-container',
      8080,
      mockExec
    );

    const result = await verifier.verify();

    expect(result).toBe(false);
  });

  test('should handle exec errors', async () => {
    const mockExec = mock(async () => {
      throw new Error('Container not running');
    });

    const verifier = new OpenCodeSessionVerifier(
      'test-session-id',
      'test-container',
      8080,
      mockExec
    );

    const result = await verifier.verify();

    expect(result).toBe(false);
  });

  test('should return true if no session to verify', async () => {
    const mockExec = mock(async () => ({
      stdout: '200',
      exitCode: 0,
    }));

    const verifier = new OpenCodeSessionVerifier(undefined, 'test-container', 8080, mockExec);

    const result = await verifier.verify();

    expect(result).toBe(true);
    expect(mockExec).not.toHaveBeenCalled();
  });

  test('should get idle status', async () => {
    const mockExec = mock(async () => ({
      stdout: JSON.stringify({
        'test-session-id': { type: 'idle' },
      }),
      exitCode: 0,
    }));

    const verifier = new OpenCodeSessionVerifier(
      'test-session-id',
      'test-container',
      8080,
      mockExec
    );

    const status = await verifier.getStatus();

    expect(status).toBe('idle');
  });

  test('should get busy status', async () => {
    const mockExec = mock(async () => ({
      stdout: JSON.stringify({
        'test-session-id': { type: 'busy' },
      }),
      exitCode: 0,
    }));

    const verifier = new OpenCodeSessionVerifier(
      'test-session-id',
      'test-container',
      8080,
      mockExec
    );

    const status = await verifier.getStatus();

    expect(status).toBe('busy');
  });

  test('should return unknown status for missing session', async () => {
    const mockExec = mock(async () => ({
      stdout: JSON.stringify({}),
      exitCode: 0,
    }));

    const verifier = new OpenCodeSessionVerifier(
      'test-session-id',
      'test-container',
      8080,
      mockExec
    );

    const status = await verifier.getStatus();

    expect(status).toBe('unknown');
  });

  test('should return unknown status on error', async () => {
    const mockExec = mock(async () => {
      throw new Error('Network error');
    });

    const verifier = new OpenCodeSessionVerifier(
      'test-session-id',
      'test-container',
      8080,
      mockExec
    );

    const status = await verifier.getStatus();

    expect(status).toBe('unknown');
  });
});

describe('ClaudeCodeSessionVerifier', () => {
  test('should verify existing session', async () => {
    const mockCheck = mock(async () => true);

    const verifier = new ClaudeCodeSessionVerifier('test-session-id', mockCheck);

    const result = await verifier.verify();

    expect(result).toBe(true);
    expect(mockCheck).toHaveBeenCalledWith('test-session-id');
  });

  test('should return false for non-existent session', async () => {
    const mockCheck = mock(async () => false);

    const verifier = new ClaudeCodeSessionVerifier('test-session-id', mockCheck);

    const result = await verifier.verify();

    expect(result).toBe(false);
  });

  test('should return true if no session to verify', async () => {
    const mockCheck = mock(async () => true);

    const verifier = new ClaudeCodeSessionVerifier(undefined, mockCheck);

    const result = await verifier.verify();

    expect(result).toBe(true);
    expect(mockCheck).not.toHaveBeenCalled();
  });

  test('should handle check errors', async () => {
    const mockCheck = mock(async () => {
      throw new Error('Filesystem error');
    });

    const verifier = new ClaudeCodeSessionVerifier('test-session-id', mockCheck);

    const result = await verifier.verify();

    expect(result).toBe(false);
  });

  test('should always return unknown status', async () => {
    const mockCheck = mock(async () => true);

    const verifier = new ClaudeCodeSessionVerifier('test-session-id', mockCheck);

    const status = await verifier.getStatus();

    expect(status).toBe('unknown');
  });
});

describe('verifyAndNotify', () => {
  test('should send expired message when session does not exist', async () => {
    const mockExec = mock(async () => ({
      stdout: '404',
      exitCode: 0,
    }));

    const messages: ChatMessage[] = [];
    let expiredCalled = false;

    const verifier = new OpenCodeSessionVerifier(
      'test-session-id',
      'test-container',
      8080,
      mockExec
    );

    const result = await verifier.verifyAndNotify({
      onMessage: (msg) => messages.push(msg),
      onSessionExpired: () => {
        expiredCalled = true;
      },
    });

    expect(result).toBe(false);
    expect(expiredCalled).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('system');
    expect(messages[0].content).toContain('expired');
  });

  test('should send busy message when session is busy', async () => {
    const mockExec = mock()
      .mockImplementationOnce(async () => ({
        stdout: '200',
        exitCode: 0,
      }))
      .mockImplementationOnce(async () => ({
        stdout: JSON.stringify({
          'test-session-id': { type: 'busy' },
        }),
        exitCode: 0,
      }));

    const messages: ChatMessage[] = [];
    let busyCalled = false;

    const verifier = new OpenCodeSessionVerifier(
      'test-session-id',
      'test-container',
      8080,
      mockExec
    );

    const result = await verifier.verifyAndNotify({
      onMessage: (msg) => messages.push(msg),
      onSessionBusy: () => {
        busyCalled = true;
      },
    });

    expect(result).toBe(true);
    expect(busyCalled).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('system');
    expect(messages[0].content).toContain('busy');
  });

  test('should not send messages when session is idle', async () => {
    const mockExec = mock()
      .mockImplementationOnce(async () => ({
        stdout: '200',
        exitCode: 0,
      }))
      .mockImplementationOnce(async () => ({
        stdout: JSON.stringify({
          'test-session-id': { type: 'idle' },
        }),
        exitCode: 0,
      }));

    const messages: ChatMessage[] = [];

    const verifier = new OpenCodeSessionVerifier(
      'test-session-id',
      'test-container',
      8080,
      mockExec
    );

    const result = await verifier.verifyAndNotify({
      onMessage: (msg) => messages.push(msg),
    });

    expect(result).toBe(true);
    expect(messages).toHaveLength(0);
  });

  test('should work without optional callbacks', async () => {
    const mockExec = mock(async () => ({
      stdout: '404',
      exitCode: 0,
    }));

    const messages: ChatMessage[] = [];

    const verifier = new OpenCodeSessionVerifier(
      'test-session-id',
      'test-container',
      8080,
      mockExec
    );

    const result = await verifier.verifyAndNotify({
      onMessage: (msg) => messages.push(msg),
    });

    expect(result).toBe(false);
    expect(messages).toHaveLength(1);
  });
});

describe('handleSessionPickup', () => {
  test('should call onNoSession when session does not exist', async () => {
    const mockCheck = mock(async () => false);
    let noSessionCalled = false;

    const verifier = new ClaudeCodeSessionVerifier('test-session-id', mockCheck);

    await handleSessionPickup(verifier, {
      onMessage: () => {},
      onNoSession: async () => {
        noSessionCalled = true;
      },
    });

    expect(noSessionCalled).toBe(true);
  });

  test('should not call onNoSession when session exists', async () => {
    const mockCheck = mock(async () => true);
    let noSessionCalled = false;

    const verifier = new ClaudeCodeSessionVerifier('test-session-id', mockCheck);

    await handleSessionPickup(verifier, {
      onMessage: () => {},
      onNoSession: async () => {
        noSessionCalled = true;
      },
    });

    expect(noSessionCalled).toBe(false);
  });
});

describe('createSessionVerifier', () => {
  test('should create OpenCode verifier', () => {
    const mockExec = mock(async () => ({ stdout: '', exitCode: 0 }));

    const verifier = createSessionVerifier('opencode', 'test-session-id', {
      containerName: 'test-container',
      port: 8080,
      execInContainer: mockExec,
    });

    expect(verifier).toBeInstanceOf(OpenCodeSessionVerifier);
  });

  test('should create Claude Code verifier', () => {
    const mockCheck = mock(async () => true);

    const verifier = createSessionVerifier('claude-code', 'test-session-id', {
      checkSessionFile: mockCheck,
    });

    expect(verifier).toBeInstanceOf(ClaudeCodeSessionVerifier);
  });

  test('should throw if OpenCode verifier missing config', () => {
    expect(() => {
      createSessionVerifier('opencode', 'test-session-id', {});
    }).toThrow('OpenCode verifier requires');
  });

  test('should throw if Claude Code verifier missing config', () => {
    expect(() => {
      createSessionVerifier('claude-code', 'test-session-id', {});
    }).toThrow('Claude Code verifier requires');
  });

  test('should work with undefined session ID', () => {
    const mockCheck = mock(async () => true);

    const verifier = createSessionVerifier('claude-code', undefined, {
      checkSessionFile: mockCheck,
    });

    expect(verifier).toBeInstanceOf(ClaudeCodeSessionVerifier);
  });
});
