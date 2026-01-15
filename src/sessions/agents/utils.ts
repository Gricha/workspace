import type { SessionMessage } from '../types';

export function decodeClaudeProjectPath(encoded: string): string {
  return encoded.replace(/-/g, '/');
}

export function encodeClaudeProjectPath(projectPath: string): string {
  return projectPath.replace(/\//g, '-');
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
  if (!content) return null;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textParts = content
      .filter(
        (part): part is { type: string; text?: string } =>
          typeof part === 'object' && part !== null && 'type' in part
      )
      .filter((part) => part.type === 'text' && part.text)
      .map((part) => part.text);
    return textParts.join('\n') || null;
  }
  return null;
}
