import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '../../src/chat/types';

describe('Message ID types', () => {
  describe('ChatMessage', () => {
    it('includes optional messageId field', () => {
      const message: ChatMessage = {
        type: 'assistant',
        content: 'Hello',
        timestamp: new Date().toISOString(),
        messageId: 'msg_123',
      };

      expect(message.messageId).toBe('msg_123');
    });

    it('allows messageId to be undefined', () => {
      const message: ChatMessage = {
        type: 'assistant',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      };

      expect(message.messageId).toBeUndefined();
    });

    it('includes messageId with all message types', () => {
      const messageTypes: ChatMessage['type'][] = [
        'user',
        'assistant',
        'system',
        'tool_use',
        'tool_result',
        'error',
        'done',
      ];

      for (const type of messageTypes) {
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

  describe('Message ID format', () => {
    it('handles Claude-style message IDs', () => {
      const claudeMessageId = 'msg_01Xx3rAZ93AyDpMALs8nCJ9n';
      const message: ChatMessage = {
        type: 'assistant',
        content: 'Hello from Claude',
        timestamp: new Date().toISOString(),
        messageId: claudeMessageId,
      };

      expect(message.messageId).toBe(claudeMessageId);
      expect(message.messageId?.startsWith('msg_')).toBe(true);
    });

    it('handles UUID-style message IDs (OpenCode)', () => {
      const opencodeMessageId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const message: ChatMessage = {
        type: 'assistant',
        content: 'Hello from OpenCode',
        timestamp: new Date().toISOString(),
        messageId: opencodeMessageId,
      };

      expect(message.messageId).toBe(opencodeMessageId);
    });
  });

  describe('Client deduplication scenarios', () => {
    it('can deduplicate messages by messageId', () => {
      const messages: ChatMessage[] = [
        {
          type: 'assistant',
          content: 'Hello ',
          timestamp: '2024-01-01T00:00:00Z',
          messageId: 'msg_1',
        },
        {
          type: 'assistant',
          content: 'world!',
          timestamp: '2024-01-01T00:00:01Z',
          messageId: 'msg_1',
        },
        {
          type: 'assistant',
          content: 'Hello ',
          timestamp: '2024-01-01T00:00:00Z',
          messageId: 'msg_1',
        }, // duplicate
      ];

      const seen = new Set<string>();
      const deduped = messages.filter((msg) => {
        const key = `${msg.messageId}-${msg.content}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      expect(deduped).toHaveLength(2);
    });

    it('handles messages without messageId (legacy)', () => {
      const messages: ChatMessage[] = [
        { type: 'assistant', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
        { type: 'assistant', content: 'Hello', timestamp: '2024-01-01T00:00:01Z' },
      ];

      // Without messageId, fallback to timestamp for dedup
      const seen = new Set<string>();
      const deduped = messages.filter((msg) => {
        const key = msg.messageId || `${msg.timestamp}-${msg.content}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      expect(deduped).toHaveLength(2); // Different timestamps, both kept
    });

    it('groups streaming deltas by messageId', () => {
      const messages: ChatMessage[] = [
        { type: 'assistant', content: 'He', timestamp: '2024-01-01T00:00:00Z', messageId: 'msg_1' },
        {
          type: 'assistant',
          content: 'llo',
          timestamp: '2024-01-01T00:00:01Z',
          messageId: 'msg_1',
        },
        {
          type: 'assistant',
          content: ' wo',
          timestamp: '2024-01-01T00:00:02Z',
          messageId: 'msg_1',
        },
        {
          type: 'assistant',
          content: 'rld',
          timestamp: '2024-01-01T00:00:03Z',
          messageId: 'msg_1',
        },
        {
          type: 'done',
          content: 'Complete',
          timestamp: '2024-01-01T00:00:04Z',
          messageId: 'msg_1',
        },
      ];

      // Group by messageId
      const grouped = new Map<string, ChatMessage[]>();
      for (const msg of messages) {
        const id = msg.messageId || 'unknown';
        if (!grouped.has(id)) grouped.set(id, []);
        grouped.get(id)!.push(msg);
      }

      expect(grouped.get('msg_1')).toHaveLength(5);

      // Reconstruct full content
      const assistantContent = grouped
        .get('msg_1')!
        .filter((m) => m.type === 'assistant')
        .map((m) => m.content)
        .join('');

      expect(assistantContent).toBe('Hello world');
    });
  });
});
