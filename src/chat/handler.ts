import { query, type SDKMessage, type Query } from '@anthropic-ai/claude-agent-sdk';

export interface ChatOptions {
  containerName: string;
  workDir?: string;
  sessionId?: string;
  model?: string;
}

export interface ChatMessage {
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result' | 'error' | 'done';
  content: string;
  timestamp: string;
  toolName?: string;
  toolId?: string;
}

export class ChatSession {
  private query: Query | null = null;
  private abortController: AbortController;
  private containerName: string;
  private workDir: string;
  private sessionId?: string;
  private model: string;
  private onMessage: (message: ChatMessage) => void;

  constructor(options: ChatOptions, onMessage: (message: ChatMessage) => void) {
    this.containerName = options.containerName;
    this.workDir = options.workDir || '/workspace';
    this.sessionId = options.sessionId;
    this.model = options.model || 'claude-sonnet-4-20250514';
    this.onMessage = onMessage;
    this.abortController = new AbortController();
  }

  async sendMessage(userMessage: string): Promise<void> {
    try {
      this.query = query({
        prompt: userMessage,
        options: {
          abortController: this.abortController,
          cwd: this.workDir,
          model: this.model,
          resume: this.sessionId,
          permissionMode: 'acceptEdits',
          includePartialMessages: true,
          systemPrompt: {
            type: 'preset',
            preset: 'claude_code',
            append: `You are running inside a workspace container. Execute commands using the Bash tool.
The workspace directory is ${this.workDir}.
Be concise in your responses.`,
          },
          tools: {
            type: 'preset',
            preset: 'claude_code',
          },
        },
      });

      for await (const message of this.query) {
        this.handleMessage(message);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.onMessage({
          type: 'system',
          content: 'Chat interrupted',
          timestamp: new Date().toISOString(),
        });
      } else {
        this.onMessage({
          type: 'error',
          content: (err as Error).message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private handleMessage(message: SDKMessage): void {
    const timestamp = new Date().toISOString();

    switch (message.type) {
      case 'assistant': {
        const content = message.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              this.onMessage({
                type: 'assistant',
                content: block.text,
                timestamp,
              });
            } else if (block.type === 'tool_use') {
              this.onMessage({
                type: 'tool_use',
                content: JSON.stringify(block.input, null, 2),
                toolName: block.name,
                toolId: block.id,
                timestamp,
              });
            }
          }
        }
        break;
      }

      case 'user': {
        if (!this.sessionId) {
          this.sessionId = message.session_id;
        }
        break;
      }

      case 'result': {
        this.onMessage({
          type: 'done',
          content: message.subtype === 'success' ? message.result : 'Session ended with errors',
          timestamp,
        });
        break;
      }

      case 'system': {
        if (message.subtype === 'init') {
          this.sessionId = message.session_id;
          this.onMessage({
            type: 'system',
            content: `Session started with ${message.model}`,
            timestamp,
          });
        }
        break;
      }

      case 'stream_event': {
        if (message.event.type === 'content_block_delta') {
          const delta = message.event.delta;
          if ('text' in delta) {
            this.onMessage({
              type: 'assistant',
              content: delta.text,
              timestamp,
            });
          }
        }
        break;
      }
    }
  }

  async interrupt(): Promise<void> {
    if (this.query) {
      await this.query.interrupt();
    }
    this.abortController.abort();
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }
}

export function createChatSession(
  options: ChatOptions,
  onMessage: (message: ChatMessage) => void
): ChatSession {
  return new ChatSession(options, onMessage);
}
