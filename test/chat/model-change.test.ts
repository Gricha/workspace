import { describe, test, expect } from 'vitest';

interface MockChatMessage {
  type: string;
  content: string;
  timestamp: string;
}

class MockChatSession {
  private sessionId?: string;
  private model: string;
  private onMessage: (message: MockChatMessage) => void;

  constructor(
    options: { sessionId?: string; model?: string },
    onMessage: (message: MockChatMessage) => void
  ) {
    this.sessionId = options.sessionId;
    this.model = options.model || 'sonnet';
    this.onMessage = onMessage;
  }

  setModel(model: string): void {
    if (this.model === model) return;

    this.model = model;
    this.onMessage({
      type: 'system',
      content: `Switching to model: ${model}`,
      timestamp: new Date().toISOString(),
    });
  }

  simulateSessionStart(sessionId: string): void {
    this.sessionId = sessionId;
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  getModel(): string {
    return this.model;
  }
}

describe('Model change behavior', () => {
  test('setModel updates model and emits message', () => {
    const messages: MockChatMessage[] = [];
    const session = new MockChatSession({ model: 'sonnet' }, (msg) => messages.push(msg));

    session.setModel('opus');

    expect(session.getModel()).toBe('opus');
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('Switching to model: opus');
  });

  test('setModel with same model does nothing', () => {
    const messages: MockChatMessage[] = [];
    const session = new MockChatSession({ model: 'sonnet' }, (msg) => messages.push(msg));

    session.setModel('sonnet');

    expect(messages).toHaveLength(0);
    expect(session.getModel()).toBe('sonnet');
  });

  test('setModel does not clear session id', () => {
    const messages: MockChatMessage[] = [];
    const session = new MockChatSession({ model: 'sonnet' }, (msg) => messages.push(msg));

    session.simulateSessionStart('session-123');
    session.setModel('opus');

    expect(session.getSessionId()).toBe('session-123');
  });
});
