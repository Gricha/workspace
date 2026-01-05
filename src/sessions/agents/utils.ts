import type { SessionMessage } from '../types';

export function decodeClaudeProjectPath(encoded: string): string {
  return encoded.replace(/-/g, '/');
}

export function extractFirstUserPrompt(messages: SessionMessage[]): string | null {
  const firstPrompt = messages.find(
    (msg) => msg.type === 'user' && msg.content && msg.content.trim().length > 0
  );
  return firstPrompt?.content ? firstPrompt.content.slice(0, 200) : null;
}

export function extractClaudeSessionName(content: string): string | null {
  const lines = content.split('\n').filter((line) => line.trim());
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as { type?: string; subtype?: string; name?: string };
      if (obj.type === 'system' && obj.subtype === 'session_name') {
        return obj.name || null;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function extractContent(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content.find((c: { type: string; text?: string }) => c.type === 'text')?.text;
    return typeof text === 'string' ? text : null;
  }
  return null;
}
