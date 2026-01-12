import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '../../src/chat/types';
import { ClaudeCodeAdapter } from '../../src/session-manager/adapters/claude';

describe('ClaudeCodeAdapter projectPath', () => {
  it('uses default workDir when no projectPath provided', async () => {
    const adapter = new ClaudeCodeAdapter();
    await adapter.start({
      workspaceName: 'test',
      containerName: 'workspace-test',
      isHost: false,
    });

    // Access private workDir via any - this is a unit test
    expect((adapter as unknown as { workDir: string }).workDir).toBe('/home/workspace');
  });

  it('uses projectPath as workDir when provided', async () => {
    const adapter = new ClaudeCodeAdapter();
    await adapter.start({
      workspaceName: 'test',
      containerName: 'workspace-test',
      isHost: false,
      projectPath: '/home/workspace/myproject',
    });

    expect((adapter as unknown as { workDir: string }).workDir).toBe('/home/workspace/myproject');
  });

  it('uses projectPath for nested directory paths', async () => {
    const adapter = new ClaudeCodeAdapter();
    await adapter.start({
      workspaceName: 'test',
      containerName: 'workspace-test',
      isHost: false,
      projectPath: '/home/workspace/deep/nested/project',
    });

    expect((adapter as unknown as { workDir: string }).workDir).toBe(
      '/home/workspace/deep/nested/project'
    );
  });
});

describe('Message ID type validation', () => {
  describe('ChatMessage interface', () => {
    it('supports messageId as optional field', () => {
      const messageWithId: ChatMessage = {
        type: 'assistant',
        content: 'Hello',
        timestamp: new Date().toISOString(),
        messageId: 'msg_123',
      };
      expect(messageWithId.messageId).toBe('msg_123');

      const messageWithoutId: ChatMessage = {
        type: 'assistant',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      };
      expect(messageWithoutId.messageId).toBeUndefined();
    });

    it('supports messageId on all message types', () => {
      const types: ChatMessage['type'][] = [
        'user',
        'assistant',
        'system',
        'tool_use',
        'tool_result',
        'error',
        'done',
      ];

      for (const type of types) {
        const message: ChatMessage = {
          type,
          content: 'test',
          timestamp: new Date().toISOString(),
          messageId: `msg_${type}`,
        };
        expect(message.messageId).toBe(`msg_${type}`);
      }
    });
  });

  describe('upstream message ID formats', () => {
    it('handles Claude-style message IDs (msg_XXX)', () => {
      const claudeId = 'msg_01Xx3rAZ93AyDpMALs8nCJ9n';
      const message: ChatMessage = {
        type: 'assistant',
        content: 'Hello',
        timestamp: new Date().toISOString(),
        messageId: claudeId,
      };

      expect(message.messageId).toBe(claudeId);
      expect(message.messageId?.startsWith('msg_')).toBe(true);
    });

    it('handles UUID-style message IDs (OpenCode)', () => {
      const opencodeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const message: ChatMessage = {
        type: 'assistant',
        content: 'Hello',
        timestamp: new Date().toISOString(),
        messageId: opencodeId,
      };

      expect(message.messageId).toBe(opencodeId);
    });
  });
});

describe('Client-side deduplication patterns', () => {
  describe('streaming chunk grouping', () => {
    it('groups streaming chunks by messageId', () => {
      const chunks: ChatMessage[] = [
        {
          type: 'assistant',
          content: 'He',
          timestamp: '2024-01-01T00:00:00.000Z',
          messageId: 'msg_1',
        },
        {
          type: 'assistant',
          content: 'llo',
          timestamp: '2024-01-01T00:00:00.050Z',
          messageId: 'msg_1',
        },
        {
          type: 'assistant',
          content: ' ',
          timestamp: '2024-01-01T00:00:00.100Z',
          messageId: 'msg_1',
        },
        {
          type: 'assistant',
          content: 'world',
          timestamp: '2024-01-01T00:00:00.150Z',
          messageId: 'msg_1',
        },
        {
          type: 'done',
          content: 'Complete',
          timestamp: '2024-01-01T00:00:00.200Z',
          messageId: 'msg_1',
        },
      ];

      const grouped = new Map<string, string>();
      for (const chunk of chunks) {
        if (chunk.type === 'assistant' && chunk.messageId) {
          const existing = grouped.get(chunk.messageId) || '';
          grouped.set(chunk.messageId, existing + chunk.content);
        }
      }

      expect(grouped.get('msg_1')).toBe('Hello world');
    });

    it('separates chunks from different messages', () => {
      const chunks: ChatMessage[] = [
        {
          type: 'assistant',
          content: 'First ',
          timestamp: '2024-01-01T00:00:00Z',
          messageId: 'msg_1',
        },
        {
          type: 'assistant',
          content: 'Second ',
          timestamp: '2024-01-01T00:00:01Z',
          messageId: 'msg_2',
        },
        {
          type: 'assistant',
          content: 'message',
          timestamp: '2024-01-01T00:00:02Z',
          messageId: 'msg_1',
        },
        {
          type: 'assistant',
          content: 'content',
          timestamp: '2024-01-01T00:00:03Z',
          messageId: 'msg_2',
        },
      ];

      const byMessage = new Map<string, string[]>();
      for (const chunk of chunks) {
        if (chunk.type === 'assistant' && chunk.messageId) {
          if (!byMessage.has(chunk.messageId)) byMessage.set(chunk.messageId, []);
          byMessage.get(chunk.messageId)!.push(chunk.content);
        }
      }

      expect(byMessage.get('msg_1')?.join('')).toBe('First message');
      expect(byMessage.get('msg_2')?.join('')).toBe('Second content');
    });
  });

  describe('duplicate detection', () => {
    it('detects duplicates using messageId + content', () => {
      const received: ChatMessage[] = [];
      const seen = new Set<string>();

      const processMessage = (msg: ChatMessage) => {
        const dedupKey = msg.messageId
          ? `${msg.messageId}:${msg.content}`
          : `${msg.timestamp}:${msg.content}`;
        if (seen.has(dedupKey)) return false;
        seen.add(dedupKey);
        received.push(msg);
        return true;
      };

      const originalMessages: ChatMessage[] = [
        {
          type: 'assistant',
          content: 'Hello',
          timestamp: '2024-01-01T00:00:00.000Z',
          messageId: 'msg_1',
        },
        {
          type: 'assistant',
          content: ' world',
          timestamp: '2024-01-01T00:00:00.050Z',
          messageId: 'msg_1',
        },
      ];

      originalMessages.forEach(processMessage);
      expect(received).toHaveLength(2);

      originalMessages.forEach(processMessage);
      expect(received).toHaveLength(2);
    });

    it('allows same content with different messageIds', () => {
      const received: ChatMessage[] = [];
      const seen = new Set<string>();

      const processMessage = (msg: ChatMessage) => {
        const dedupKey = msg.messageId
          ? `${msg.messageId}:${msg.content}`
          : `${msg.timestamp}:${msg.content}`;
        if (seen.has(dedupKey)) return false;
        seen.add(dedupKey);
        received.push(msg);
        return true;
      };

      const messages: ChatMessage[] = [
        {
          type: 'assistant',
          content: 'Hello',
          timestamp: '2024-01-01T00:00:00Z',
          messageId: 'msg_1',
        },
        {
          type: 'assistant',
          content: 'Hello',
          timestamp: '2024-01-01T00:00:01Z',
          messageId: 'msg_2',
        },
      ];

      messages.forEach(processMessage);
      expect(received).toHaveLength(2);
    });

    it('falls back to timestamp for messages without messageId', () => {
      const received: ChatMessage[] = [];
      const seen = new Set<string>();

      const processMessage = (msg: ChatMessage) => {
        const dedupKey = msg.messageId
          ? `${msg.messageId}:${msg.content}`
          : `${msg.timestamp}:${msg.content}`;
        if (seen.has(dedupKey)) return false;
        seen.add(dedupKey);
        received.push(msg);
        return true;
      };

      const messages: ChatMessage[] = [
        { type: 'assistant', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
        { type: 'assistant', content: 'Hello', timestamp: '2024-01-01T00:00:01Z' },
        { type: 'assistant', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
      ];

      messages.forEach(processMessage);
      expect(received).toHaveLength(2);
    });
  });

  describe('interleaved message handling', () => {
    it('handles interleaved messages from different sessions', () => {
      const messages: ChatMessage[] = [
        {
          type: 'assistant',
          content: 'A1',
          timestamp: '2024-01-01T00:00:00.000Z',
          messageId: 'msg_a',
        },
        {
          type: 'assistant',
          content: 'B1',
          timestamp: '2024-01-01T00:00:00.010Z',
          messageId: 'msg_b',
        },
        {
          type: 'assistant',
          content: 'A2',
          timestamp: '2024-01-01T00:00:00.020Z',
          messageId: 'msg_a',
        },
        {
          type: 'assistant',
          content: 'B2',
          timestamp: '2024-01-01T00:00:00.030Z',
          messageId: 'msg_b',
        },
      ];

      const byMessage = new Map<string, ChatMessage[]>();
      for (const msg of messages) {
        const id = msg.messageId || 'unknown';
        if (!byMessage.has(id)) byMessage.set(id, []);
        byMessage.get(id)!.push(msg);
      }

      expect(
        byMessage
          .get('msg_a')
          ?.map((m) => m.content)
          .join('')
      ).toBe('A1A2');
      expect(
        byMessage
          .get('msg_b')
          ?.map((m) => m.content)
          .join('')
      ).toBe('B1B2');
    });

    it('correctly orders chunks by timestamp within a message', () => {
      const chunks: ChatMessage[] = [
        { type: 'assistant', content: 'C', timestamp: '2024-01-01T00:00:02Z', messageId: 'msg_1' },
        { type: 'assistant', content: 'A', timestamp: '2024-01-01T00:00:00Z', messageId: 'msg_1' },
        { type: 'assistant', content: 'B', timestamp: '2024-01-01T00:00:01Z', messageId: 'msg_1' },
      ];

      const sorted = [...chunks].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      expect(sorted.map((c) => c.content).join('')).toBe('ABC');
    });
  });
});

describe('BufferedMessage with messageId', () => {
  it('preserves messageId through buffer', () => {
    const message: ChatMessage = {
      type: 'assistant',
      content: 'Buffered content',
      timestamp: new Date().toISOString(),
      messageId: 'msg_buffered',
    };

    const buffered = {
      id: 1,
      message,
      timestamp: Date.now(),
    };

    expect(buffered.message.messageId).toBe('msg_buffered');
  });

  it('supports replay of buffered messages with messageId for dedup', () => {
    const buffer: Array<{ id: number; message: ChatMessage; timestamp: number }> = [
      {
        id: 1,
        message: {
          type: 'assistant',
          content: 'First',
          timestamp: '2024-01-01T00:00:00Z',
          messageId: 'msg_replay',
        },
        timestamp: Date.now(),
      },
      {
        id: 2,
        message: {
          type: 'assistant',
          content: 'Second',
          timestamp: '2024-01-01T00:00:01Z',
          messageId: 'msg_replay',
        },
        timestamp: Date.now(),
      },
    ];

    const clientSeen = new Set<string>();
    const replayed = buffer.filter((b) => {
      const key = `${b.message.messageId}:${b.message.content}`;
      if (clientSeen.has(key)) return false;
      clientSeen.add(key);
      return true;
    });

    expect(replayed).toHaveLength(2);

    const replayedAgain = buffer.filter((b) => {
      const key = `${b.message.messageId}:${b.message.content}`;
      if (clientSeen.has(key)) return false;
      clientSeen.add(key);
      return true;
    });

    expect(replayedAgain).toHaveLength(0);
  });

  it('handles mixed buffered messages with and without messageId', () => {
    const buffer: Array<{ id: number; message: ChatMessage; timestamp: number }> = [
      {
        id: 1,
        message: {
          type: 'assistant',
          content: 'With ID',
          timestamp: '2024-01-01T00:00:00Z',
          messageId: 'msg_1',
        },
        timestamp: Date.now(),
      },
      {
        id: 2,
        message: { type: 'system', content: 'No ID', timestamp: '2024-01-01T00:00:01Z' },
        timestamp: Date.now(),
      },
      {
        id: 3,
        message: {
          type: 'assistant',
          content: 'Also with ID',
          timestamp: '2024-01-01T00:00:02Z',
          messageId: 'msg_2',
        },
        timestamp: Date.now(),
      },
    ];

    const withId = buffer.filter((b) => b.message.messageId !== undefined);
    const withoutId = buffer.filter((b) => b.message.messageId === undefined);

    expect(withId).toHaveLength(2);
    expect(withoutId).toHaveLength(1);
  });
});

describe('Tool message ID propagation', () => {
  it('tool_use messages carry messageId from parent assistant turn', () => {
    const assistantMessageId = 'msg_tools_123';
    const toolMessages: ChatMessage[] = [
      {
        type: 'tool_use',
        content: '{"path": "/test.txt"}',
        timestamp: '2024-01-01T00:00:00Z',
        messageId: assistantMessageId,
        toolName: 'read_file',
        toolId: 'tool_1',
      },
      {
        type: 'tool_use',
        content: '{"path": "/out.txt"}',
        timestamp: '2024-01-01T00:00:01Z',
        messageId: assistantMessageId,
        toolName: 'write_file',
        toolId: 'tool_2',
      },
    ];

    expect(toolMessages.every((m) => m.messageId === assistantMessageId)).toBe(true);
  });

  it('tool_result messages can be grouped with their tool_use', () => {
    const messages: ChatMessage[] = [
      {
        type: 'tool_use',
        content: '{"path": "/test.txt"}',
        timestamp: '2024-01-01T00:00:00Z',
        messageId: 'msg_1',
        toolId: 'tool_abc',
      },
      {
        type: 'tool_result',
        content: 'file contents',
        timestamp: '2024-01-01T00:00:01Z',
        messageId: 'msg_1',
        toolId: 'tool_abc',
      },
    ];

    const toolPairs = new Map<string, { use?: ChatMessage; result?: ChatMessage }>();
    for (const msg of messages) {
      if (msg.toolId) {
        if (!toolPairs.has(msg.toolId)) toolPairs.set(msg.toolId, {});
        const pair = toolPairs.get(msg.toolId)!;
        if (msg.type === 'tool_use') pair.use = msg;
        if (msg.type === 'tool_result') pair.result = msg;
      }
    }

    const pair = toolPairs.get('tool_abc');
    expect(pair?.use?.messageId).toBe('msg_1');
    expect(pair?.result?.messageId).toBe('msg_1');
  });
});

describe('Done message association', () => {
  it('done message carries messageId of completed response', () => {
    const doneMessage: ChatMessage = {
      type: 'done',
      content: 'Response complete',
      timestamp: '2024-01-01T00:00:00Z',
      messageId: 'msg_complete',
    };

    expect(doneMessage.messageId).toBe('msg_complete');
  });

  it('can correlate done with prior assistant chunks', () => {
    const messages: ChatMessage[] = [
      {
        type: 'assistant',
        content: 'Hello ',
        timestamp: '2024-01-01T00:00:00Z',
        messageId: 'msg_1',
      },
      {
        type: 'assistant',
        content: 'world',
        timestamp: '2024-01-01T00:00:01Z',
        messageId: 'msg_1',
      },
      { type: 'done', content: 'Complete', timestamp: '2024-01-01T00:00:02Z', messageId: 'msg_1' },
    ];

    const done = messages.find((m) => m.type === 'done');
    const chunks = messages.filter(
      (m) => m.type === 'assistant' && m.messageId === done?.messageId
    );

    expect(chunks).toHaveLength(2);
    expect(chunks.map((c) => c.content).join('')).toBe('Hello world');
  });
});
