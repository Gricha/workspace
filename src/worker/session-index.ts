import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { watch, type FSWatcher } from 'node:fs';

export interface IndexedSession {
  id: string;
  agentType: 'claude' | 'opencode';
  title: string;
  directory: string;
  filePath: string;
  messageCount: number;
  firstPrompt: string | null;
  lastActivity: number;
}

interface WatcherEntry {
  watcher: FSWatcher;
  debounceTimer?: ReturnType<typeof setTimeout>;
}

class SessionIndex {
  private sessions = new Map<string, IndexedSession>();
  private watchers: WatcherEntry[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([this.discoverClaudeSessions(), this.discoverOpencodeSessions()]);

    this.initialized = true;
  }

  async refresh(): Promise<void> {
    await Promise.all([this.discoverClaudeSessions(), this.discoverOpencodeSessions()]);
  }

  startWatchers(): void {
    const claudeDir = path.join(os.homedir(), '.claude', 'projects');
    const opencodeDir = path.join(
      os.homedir(),
      '.local',
      'share',
      'opencode',
      'storage',
      'session'
    );

    this.watchDirectory(claudeDir, 'claude');
    this.watchDirectory(opencodeDir, 'opencode');
  }

  stopWatchers(): void {
    for (const entry of this.watchers) {
      if (entry.debounceTimer) {
        clearTimeout(entry.debounceTimer);
      }
      entry.watcher.close();
    }
    this.watchers = [];
  }

  list(): IndexedSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.lastActivity - a.lastActivity);
  }

  get(id: string): IndexedSession | undefined {
    return this.sessions.get(id);
  }

  async getMessages(
    id: string,
    opts: { limit: number; offset: number }
  ): Promise<{ id: string; messages: Message[]; total: number }> {
    const session = this.sessions.get(id);
    if (!session) {
      return { id, messages: [], total: 0 };
    }

    if (session.agentType === 'claude') {
      return this.getClaudeMessages(session, opts);
    } else {
      return this.getOpencodeMessages(session, opts);
    }
  }

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(id);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    try {
      if (session.agentType === 'claude') {
        await fs.unlink(session.filePath);
      } else {
        const { deleteOpencodeSession } = await import('../sessions/agents/opencode-storage');
        const result = await deleteOpencodeSession(id);
        if (!result.success) {
          return result;
        }
      }

      this.sessions.delete(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  private async discoverClaudeSessions(): Promise<void> {
    const claudeDir = path.join(os.homedir(), '.claude', 'projects');

    try {
      const projectDirs = await fs.readdir(claudeDir, { withFileTypes: true });

      await Promise.all(
        projectDirs.map(async (projectDir) => {
          if (!projectDir.isDirectory()) return;

          const projectPath = path.join(claudeDir, projectDir.name);
          try {
            const files = await fs.readdir(projectPath);

            await Promise.all(
              files.map(async (file) => {
                if (!file.endsWith('.jsonl') || file.startsWith('agent-')) return;

                const filePath = path.join(projectPath, file);
                await this.indexClaudeSession(filePath, projectDir.name);
              })
            );
          } catch {
            // Project directory may have been removed
          }
        })
      );
    } catch {
      // Claude directory doesn't exist
    }
  }

  private async discoverOpencodeSessions(): Promise<void> {
    try {
      const { listOpencodeSessions } = await import('../sessions/agents/opencode-storage');
      const sessions = await listOpencodeSessions();

      for (const session of sessions) {
        this.sessions.set(session.id, {
          id: session.id,
          agentType: 'opencode',
          title: session.title,
          directory: session.directory,
          filePath: session.file,
          messageCount: 0,
          firstPrompt: session.title || null,
          lastActivity: session.mtime,
        });
      }
    } catch {
      // OpenCode storage doesn't exist
    }
  }

  private async indexClaudeSession(filePath: string, projectName: string): Promise<void> {
    try {
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      if (lines.length === 0) return;

      const sessionId = path.basename(filePath, '.jsonl');
      let firstPrompt: string | null = null;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'user' || entry.type === 'human') {
            if (entry.message?.content) {
              const textContent = entry.message.content.find(
                (c: { type: string }) => c.type === 'text'
              );
              if (textContent?.text) {
                firstPrompt = textContent.text.slice(0, 200);
                break;
              }
            } else if (typeof entry.content === 'string' && entry.content.trim()) {
              firstPrompt = entry.content.slice(0, 200);
              break;
            }
          }
        } catch {
          continue;
        }
      }

      this.sessions.set(sessionId, {
        id: sessionId,
        agentType: 'claude',
        title: firstPrompt || projectName,
        directory: projectName,
        filePath,
        messageCount: lines.length,
        firstPrompt,
        lastActivity: stat.mtimeMs,
      });
    } catch {
      // File may have been removed or is invalid
    }
  }

  private watchDirectory(dir: string, agentType: 'claude' | 'opencode'): void {
    try {
      const watcher = watch(dir, { recursive: true }, (event, filename) => {
        if (!filename) return;

        const entry = this.watchers.find((w) => w.watcher === watcher);
        if (entry?.debounceTimer) {
          clearTimeout(entry.debounceTimer);
        }

        const timer = setTimeout(async () => {
          await this.handleFileChange(dir, filename, agentType);
        }, 100);

        if (entry) {
          entry.debounceTimer = timer;
        }
      });

      this.watchers.push({ watcher });
    } catch {
      // Directory doesn't exist, skip watching
    }
  }

  private async handleFileChange(
    baseDir: string,
    filename: string,
    agentType: 'claude' | 'opencode'
  ): Promise<void> {
    const filePath = path.join(baseDir, filename);

    if (agentType === 'claude') {
      if (!filename.endsWith('.jsonl') || filename.includes('agent-')) return;

      try {
        await fs.access(filePath);
        const projectName = path.dirname(filename);
        await this.indexClaudeSession(filePath, projectName);
      } catch {
        const sessionId = path.basename(filename, '.jsonl');
        this.sessions.delete(sessionId);
      }
    } else {
      if (!filename.endsWith('.json') || !filename.includes('ses_')) return;

      try {
        await this.discoverOpencodeSessions();
      } catch {
        // Re-discovery failed
      }
    }
  }

  private async getClaudeMessages(
    session: IndexedSession,
    opts: { limit: number; offset: number }
  ): Promise<{ id: string; messages: Message[]; total: number }> {
    try {
      const content = await fs.readFile(session.filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const total = lines.length;

      const startIndex = Math.max(0, total - opts.offset - opts.limit);
      const endIndex = total - opts.offset;
      const slice = lines.slice(startIndex, endIndex);

      const messages: Message[] = [];
      for (const line of slice) {
        try {
          const entry = JSON.parse(line);
          const converted = this.convertClaudeEntry(entry);
          if (converted) {
            messages.push(...converted);
          }
        } catch {
          continue;
        }
      }

      return { id: session.id, messages, total };
    } catch {
      return { id: session.id, messages: [], total: 0 };
    }
  }

  private convertClaudeEntry(entry: ClaudeLogEntry): Message[] | null {
    if (entry.type === 'user' || entry.type === 'human') {
      const textContent = entry.message?.content?.find((c) => c.type === 'text');
      if (textContent?.text) {
        return [
          {
            type: 'user',
            content: textContent.text,
            timestamp: entry.timestamp,
          },
        ];
      }
    }

    if (entry.type === 'assistant') {
      const messages: Message[] = [];
      for (const block of entry.message?.content || []) {
        if (block.type === 'text' && block.text) {
          messages.push({
            type: 'assistant',
            content: block.text,
            timestamp: entry.timestamp,
          });
        } else if (block.type === 'tool_use') {
          messages.push({
            type: 'tool_use',
            toolName: block.name,
            toolId: block.id,
            toolInput: JSON.stringify(block.input),
            timestamp: entry.timestamp,
          });
        }
      }
      return messages.length > 0 ? messages : null;
    }

    if (entry.type === 'tool_result') {
      return [
        {
          type: 'tool_result',
          content:
            typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content),
          toolId: entry.tool_use_id,
          timestamp: entry.timestamp,
        },
      ];
    }

    return null;
  }

  private async getOpencodeMessages(
    session: IndexedSession,
    opts: { limit: number; offset: number }
  ): Promise<{ id: string; messages: Message[]; total: number }> {
    try {
      const { getOpencodeSessionMessages } = await import('../sessions/agents/opencode-storage');
      const result = await getOpencodeSessionMessages(session.id);

      const total = result.messages.length;
      const startIndex = Math.max(0, total - opts.offset - opts.limit);
      const endIndex = total - opts.offset;
      const slice = result.messages.slice(startIndex, endIndex);

      const messages: Message[] = slice.map((m) => ({
        type: m.type as Message['type'],
        content: m.content,
        toolName: m.toolName,
        toolId: m.toolId,
        toolInput: m.toolInput,
        timestamp: m.timestamp,
      }));

      return { id: session.id, messages, total };
    } catch {
      return { id: session.id, messages: [], total: 0 };
    }
  }
}

export interface Message {
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result';
  content?: string;
  toolName?: string;
  toolId?: string;
  toolInput?: string;
  timestamp?: string;
}

interface ClaudeLogEntry {
  type: string;
  timestamp?: string;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      id?: string;
      input?: unknown;
    }>;
  };
  content?: unknown;
  tool_use_id?: string;
}

export const sessionIndex = new SessionIndex();
export { SessionIndex };
