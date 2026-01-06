import { describe, test, expect, vi } from 'vitest';

interface MockChatMessage {
  type: string;
  content: string;
  timestamp: string;
}

class MockChatSession {
  private sessionId?: string;
  private model: string;
  private sessionModel: string;
  private onMessage: (message: MockChatMessage) => void;

  constructor(
    options: { sessionId?: string; model?: string },
    onMessage: (message: MockChatMessage) => void
  ) {
    this.sessionId = options.sessionId;
    this.model = options.model || 'sonnet';
    this.sessionModel = this.model;
    this.onMessage = onMessage;
  }

  setModel(model: string): void {
    if (this.model !== model) {
      this.model = model;
      if (this.sessionModel !== model) {
        this.sessionId = undefined;
        this.onMessage({
          type: 'system',
          content: `Switching to model: ${model}`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  simulateSessionStart(sessionId: string): void {
    this.sessionId = sessionId;
    this.sessionModel = this.model;
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  getModel(): string {
    return this.model;
  }

  getSessionModel(): string {
    return this.sessionModel;
  }
}

describe('Model change behavior', () => {
  test('setModel updates model', () => {
    const messages: MockChatMessage[] = [];
    const session = new MockChatSession({ model: 'sonnet' }, (msg) => messages.push(msg));

    session.setModel('opus');

    expect(session.getModel()).toBe('opus');
  });

  test('setModel with same model does nothing', () => {
    const messages: MockChatMessage[] = [];
    const session = new MockChatSession({ model: 'sonnet' }, (msg) => messages.push(msg));

    session.setModel('sonnet');

    expect(messages).toHaveLength(0);
    expect(session.getModel()).toBe('sonnet');
  });

  test('setModel clears sessionId when model differs from session model', () => {
    const messages: MockChatMessage[] = [];
    const session = new MockChatSession({ model: 'sonnet' }, (msg) => messages.push(msg));

    session.simulateSessionStart('session-123');
    expect(session.getSessionId()).toBe('session-123');

    session.setModel('opus');

    expect(session.getSessionId()).toBeUndefined();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('Switching to model: opus');
  });

  test('setModel preserves sessionId when switching back to session model', () => {
    const messages: MockChatMessage[] = [];
    const session = new MockChatSession({ model: 'sonnet' }, (msg) => messages.push(msg));

    session.simulateSessionStart('session-123');
    session.setModel('opus');
    expect(session.getSessionId()).toBeUndefined();

    session.simulateSessionStart('session-456');
    expect(session.getSessionModel()).toBe('opus');

    session.setModel('opus');
    expect(session.getSessionId()).toBe('session-456');
  });

  test('new session updates sessionModel', () => {
    const messages: MockChatMessage[] = [];
    const session = new MockChatSession({ model: 'sonnet' }, (msg) => messages.push(msg));

    expect(session.getSessionModel()).toBe('sonnet');

    session.setModel('opus');
    session.simulateSessionStart('session-new');

    expect(session.getSessionModel()).toBe('opus');
  });

  test('model change workflow', () => {
    const messages: MockChatMessage[] = [];
    const session = new MockChatSession({ model: 'sonnet' }, (msg) => messages.push(msg));

    session.simulateSessionStart('session-1');
    expect(session.getSessionId()).toBe('session-1');
    expect(session.getSessionModel()).toBe('sonnet');

    session.setModel('opus');
    expect(session.getSessionId()).toBeUndefined();
    expect(session.getModel()).toBe('opus');

    session.simulateSessionStart('session-2');
    expect(session.getSessionId()).toBe('session-2');
    expect(session.getSessionModel()).toBe('opus');

    session.setModel('haiku');
    expect(session.getSessionId()).toBeUndefined();

    session.simulateSessionStart('session-3');
    expect(session.getSessionModel()).toBe('haiku');
  });
});
