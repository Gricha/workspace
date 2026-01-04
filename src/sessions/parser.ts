import { readdir, readFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import type { SessionMetadata, SessionMessage, SessionDetail, AgentType } from './types';

function decodeProjectPath(encoded: string): string {
  return encoded.replace(/-/g, '/');
}

interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content?: string | Array<{ type: string; text?: string }>;
}

type ContentPart = { type: string; text?: string } | ToolUseContent | ToolResultContent;

interface JsonlMessage {
  type?: string;
  subtype?: string;
  message?: {
    role?: string;
    content?: string | Array<ContentPart>;
  };
  content?: string | Array<ContentPart>;
  role?: string;
  timestamp?: string;
  ts?: number;
}

function extractContent(
  content: string | Array<{ type: string; text?: string }> | undefined
): string | null {
  if (!content) return null;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textParts = content.filter((c) => c.type === 'text' && c.text).map((c) => c.text);
    return textParts.join('\n') || null;
  }
  return null;
}

function extractToolMessages(content: Array<ContentPart> | undefined): SessionMessage[] {
  if (!content || !Array.isArray(content)) return [];

  const messages: SessionMessage[] = [];

  for (const part of content) {
    if (part.type === 'tool_use' && 'name' in part && 'id' in part) {
      const toolPart = part as ToolUseContent;
      messages.push({
        type: 'tool_use',
        toolName: toolPart.name,
        toolId: toolPart.id,
        toolInput: JSON.stringify(toolPart.input, null, 2),
      });
    } else if (part.type === 'tool_result' && 'tool_use_id' in part) {
      const resultPart = part as ToolResultContent;
      let resultContent: string | undefined;
      if (typeof resultPart.content === 'string') {
        resultContent = resultPart.content;
      } else if (Array.isArray(resultPart.content)) {
        resultContent = resultPart.content
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text)
          .join('\n');
      }
      messages.push({
        type: 'tool_result',
        toolId: resultPart.tool_use_id,
        content: resultContent,
      });
    }
  }

  return messages;
}

function parseJsonlLine(line: string): SessionMessage[] {
  try {
    const obj = JSON.parse(line) as JsonlMessage;
    const messages: SessionMessage[] = [];
    const timestamp = obj.timestamp || (obj.ts ? new Date(obj.ts).toISOString() : undefined);

    if (obj.type === 'user' || obj.role === 'user') {
      const content = extractContent(obj.content || obj.message?.content);
      messages.push({
        type: 'user',
        content: content || undefined,
        timestamp,
      });
    } else if (obj.type === 'assistant' || obj.role === 'assistant') {
      const rawContent = obj.content || obj.message?.content;
      const textContent = extractContent(rawContent);
      if (textContent) {
        messages.push({
          type: 'assistant',
          content: textContent,
          timestamp,
        });
      }
      if (Array.isArray(rawContent)) {
        messages.push(...extractToolMessages(rawContent));
      }
    } else if (obj.type === 'system' && obj.subtype !== 'init') {
      messages.push({
        type: 'system',
        content: extractContent(obj.content) || undefined,
        timestamp: obj.timestamp,
      });
    }

    return messages;
  } catch {
    return [];
  }
}

export async function parseSessionFile(filePath: string): Promise<SessionMessage[]> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  const messages: SessionMessage[] = [];

  for (const line of lines) {
    const lineMessages = parseJsonlLine(line);
    messages.push(...lineMessages);
  }

  return messages;
}

export async function getSessionMetadata(
  filePath: string,
  agentType: AgentType
): Promise<SessionMetadata | null> {
  try {
    const fileName = basename(filePath, '.jsonl');
    const dirName = basename(join(filePath, '..'));
    const projectPath = decodeProjectPath(dirName);

    const fileStat = await stat(filePath);
    const messages = await parseSessionFile(filePath);

    const userMessages = messages.filter((m) => m.type === 'user');
    const firstPrompt = userMessages.length > 0 ? userMessages[0].content || null : null;

    let sessionName: string | null = null;
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'system' && obj.subtype === 'session_name') {
          sessionName = obj.name || null;
          break;
        }
      } catch {
        continue;
      }
    }

    return {
      id: fileName,
      name: sessionName,
      agentType,
      projectPath,
      messageCount: messages.length,
      lastActivity: fileStat.mtime.toISOString(),
      firstPrompt: firstPrompt ? firstPrompt.slice(0, 200) : null,
      filePath,
    };
  } catch (err) {
    console.error(`[sessions] Failed to get metadata for ${filePath}:`, err);
    return null;
  }
}

export async function listClaudeCodeSessions(homeDir: string): Promise<SessionMetadata[]> {
  const claudeDir = join(homeDir, '.claude', 'projects');
  const sessions: SessionMetadata[] = [];

  try {
    const projectDirs = await readdir(claudeDir);

    for (const projectDir of projectDirs) {
      const projectPath = join(claudeDir, projectDir);
      const projectStat = await stat(projectPath);

      if (!projectStat.isDirectory()) continue;

      const files = await readdir(projectPath);
      const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

      for (const file of jsonlFiles) {
        const filePath = join(projectPath, file);
        const metadata = await getSessionMetadata(filePath, 'claude-code');
        if (metadata) {
          sessions.push(metadata);
        }
      }
    }

    sessions.sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );

    return sessions;
  } catch (err) {
    console.error(`[sessions] Failed to list Claude Code sessions:`, err);
    return [];
  }
}

export async function getSessionDetail(
  sessionId: string,
  homeDir: string,
  agentType?: AgentType
): Promise<SessionDetail | null> {
  if (!agentType || agentType === 'claude-code') {
    const result = await getClaudeCodeSessionDetail(sessionId, homeDir);
    if (result) return result;
  }

  if (!agentType || agentType === 'opencode') {
    const result = await getOpenCodeSessionDetail(sessionId, homeDir);
    if (result) return result;
  }

  if (!agentType || agentType === 'codex') {
    const result = await getCodexSessionDetail(sessionId, homeDir);
    if (result) return result;
  }

  return null;
}

async function getClaudeCodeSessionDetail(
  sessionId: string,
  homeDir: string
): Promise<SessionDetail | null> {
  const claudeDir = join(homeDir, '.claude', 'projects');

  try {
    const projectDirs = await readdir(claudeDir);

    for (const projectDir of projectDirs) {
      const projectPath = join(claudeDir, projectDir);
      const projectStat = await stat(projectPath);

      if (!projectStat.isDirectory()) continue;

      const filePath = join(projectPath, `${sessionId}.jsonl`);
      try {
        await stat(filePath);
        const metadata = await getSessionMetadata(filePath, 'claude-code');
        if (!metadata) return null;

        const messages = await parseSessionFile(filePath);

        return {
          ...metadata,
          messages,
        };
      } catch {
        continue;
      }
    }

    return null;
  } catch (err) {
    console.error(`[sessions] Failed to get Claude Code session ${sessionId}:`, err);
    return null;
  }
}

interface OpenCodeSession {
  id: string;
  version?: string;
  projectID?: string;
  directory?: string;
  title?: string;
  time?: {
    created?: number;
    updated?: number;
  };
  parentID?: string;
}

interface OpenCodeMessage {
  id?: string;
  sessionID?: string;
  role?: 'user' | 'assistant' | 'system';
  content?: string | Array<{ type: string; text?: string }>;
  time?: {
    created?: number;
  };
}

async function parseOpenCodeMessages(messageDir: string): Promise<SessionMessage[]> {
  const messages: SessionMessage[] = [];

  try {
    const files = await readdir(messageDir);
    const msgFiles = files.filter((f) => f.startsWith('msg_') && f.endsWith('.json'));
    msgFiles.sort();

    for (const file of msgFiles) {
      try {
        const content = await readFile(join(messageDir, file), 'utf-8');
        const msg = JSON.parse(content) as OpenCodeMessage;

        if (msg.role === 'user' || msg.role === 'assistant') {
          const textContent = extractContent(msg.content);
          messages.push({
            type: msg.role,
            content: textContent || undefined,
            timestamp: msg.time?.created ? new Date(msg.time.created).toISOString() : undefined,
          });
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    console.error(`[sessions] Failed to parse OpenCode messages in ${messageDir}:`, err);
    return [];
  }

  return messages;
}

export async function listOpenCodeSessions(homeDir: string): Promise<SessionMetadata[]> {
  const openCodeDir = join(homeDir, '.local', 'share', 'opencode', 'storage');
  const sessions: SessionMetadata[] = [];

  try {
    const sessionDir = join(openCodeDir, 'session');
    const projectDirs = await readdir(sessionDir);

    for (const projectDir of projectDirs) {
      const projectPath = join(sessionDir, projectDir);
      const projectStat = await stat(projectPath);

      if (!projectStat.isDirectory()) continue;

      const files = await readdir(projectPath);
      const sessionFiles = files.filter((f) => f.startsWith('ses_') && f.endsWith('.json'));

      for (const file of sessionFiles) {
        const filePath = join(projectPath, file);
        try {
          const content = await readFile(filePath, 'utf-8');
          const session = JSON.parse(content) as OpenCodeSession;
          const fileStat = await stat(filePath);

          const messageDir = join(openCodeDir, 'message', session.id);
          const messages = await parseOpenCodeMessages(messageDir);

          const userMessages = messages.filter((m) => m.type === 'user');
          const firstPrompt = userMessages.length > 0 ? userMessages[0].content || null : null;

          sessions.push({
            id: session.id,
            name: session.title || null,
            agentType: 'opencode',
            projectPath: session.directory || projectDir,
            messageCount: messages.length,
            lastActivity: session.time?.updated
              ? new Date(session.time.updated).toISOString()
              : fileStat.mtime.toISOString(),
            firstPrompt: firstPrompt ? firstPrompt.slice(0, 200) : null,
            filePath,
          });
        } catch {
          continue;
        }
      }
    }

    sessions.sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );

    return sessions;
  } catch (err) {
    console.error(`[sessions] Failed to list OpenCode sessions:`, err);
    return [];
  }
}

async function getOpenCodeSessionDetail(
  sessionId: string,
  homeDir: string
): Promise<SessionDetail | null> {
  const openCodeDir = join(homeDir, '.local', 'share', 'opencode', 'storage');

  try {
    const sessionDir = join(openCodeDir, 'session');
    const projectDirs = await readdir(sessionDir);

    for (const projectDir of projectDirs) {
      const projectPath = join(sessionDir, projectDir);
      const filePath = join(projectPath, `${sessionId}.json`);

      try {
        const content = await readFile(filePath, 'utf-8');
        const session = JSON.parse(content) as OpenCodeSession;
        const fileStat = await stat(filePath);

        const messageDir = join(openCodeDir, 'message', sessionId);
        const messages = await parseOpenCodeMessages(messageDir);

        const userMessages = messages.filter((m) => m.type === 'user');
        const firstPrompt = userMessages.length > 0 ? userMessages[0].content || null : null;

        return {
          id: session.id,
          name: session.title || null,
          agentType: 'opencode',
          projectPath: session.directory || projectDir,
          messageCount: messages.length,
          lastActivity: session.time?.updated
            ? new Date(session.time.updated).toISOString()
            : fileStat.mtime.toISOString(),
          firstPrompt: firstPrompt ? firstPrompt.slice(0, 200) : null,
          filePath,
          messages,
        };
      } catch {
        continue;
      }
    }

    return null;
  } catch (err) {
    console.error(`[sessions] Failed to get OpenCode session ${sessionId}:`, err);
    return null;
  }
}

interface CodexRolloutMeta {
  session_id?: string;
  source?: string;
  model_provider?: string;
  timestamp?: number;
}

interface CodexEvent {
  type?: string;
  payload?: {
    type?: string;
    role?: string;
    content?: string | Array<{ type: string; text?: string }>;
    message?: {
      role?: string;
      content?: string | Array<{ type: string; text?: string }>;
    };
  };
  timestamp?: number;
}

function parseCodexLine(line: string): SessionMessage | null {
  try {
    const obj = JSON.parse(line) as CodexEvent;

    const role = obj.payload?.role || obj.payload?.message?.role;
    const content = obj.payload?.content || obj.payload?.message?.content;

    if (role === 'user' || role === 'assistant') {
      const textContent = extractContent(content);
      return {
        type: role,
        content: textContent || undefined,
        timestamp: obj.timestamp ? new Date(obj.timestamp).toISOString() : undefined,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function parseCodexSessionFile(filePath: string): Promise<{
  meta: CodexRolloutMeta | null;
  messages: SessionMessage[];
}> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());
    const messages: SessionMessage[] = [];
    let meta: CodexRolloutMeta | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0) {
        try {
          meta = JSON.parse(line) as CodexRolloutMeta;
        } catch {
          meta = null;
        }
        continue;
      }

      const msg = parseCodexLine(line);
      if (msg) {
        messages.push(msg);
      }
    }

    return { meta, messages };
  } catch (err) {
    console.error(`[sessions] Failed to parse Codex session file ${filePath}:`, err);
    return { meta: null, messages: [] };
  }
}

export async function listCodexSessions(homeDir: string): Promise<SessionMetadata[]> {
  const codexDir = join(homeDir, '.codex', 'sessions');
  const sessions: SessionMetadata[] = [];

  async function scanDirectory(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir);

      for (const entry of entries) {
        const entryPath = join(dir, entry);
        const entryStat = await stat(entryPath);

        if (entryStat.isDirectory()) {
          await scanDirectory(entryPath);
        } else if (entry.startsWith('rollout-') && entry.endsWith('.jsonl')) {
          try {
            const { meta, messages } = await parseCodexSessionFile(entryPath);
            const userMessages = messages.filter((m) => m.type === 'user');
            const firstPrompt = userMessages.length > 0 ? userMessages[0].content || null : null;

            const sessionId = meta?.session_id || basename(entry, '.jsonl');

            sessions.push({
              id: sessionId,
              name: null,
              agentType: 'codex',
              projectPath: dir.replace(codexDir, '').replace(/^\//, '') || 'unknown',
              messageCount: messages.length,
              lastActivity: entryStat.mtime.toISOString(),
              firstPrompt: firstPrompt ? firstPrompt.slice(0, 200) : null,
              filePath: entryPath,
            });
          } catch {
            continue;
          }
        }
      }
    } catch (err) {
      console.error(`[sessions] Failed to scan Codex directory ${dir}:`, err);
      return;
    }
  }

  await scanDirectory(codexDir);

  sessions.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

  return sessions;
}

async function getCodexSessionDetail(
  sessionId: string,
  homeDir: string
): Promise<SessionDetail | null> {
  const sessions = await listCodexSessions(homeDir);
  const session = sessions.find((s) => s.id === sessionId);

  if (!session) return null;

  const { messages } = await parseCodexSessionFile(session.filePath);

  return {
    ...session,
    messages,
  };
}

export async function listAllSessions(homeDir: string): Promise<SessionMetadata[]> {
  const [claudeSessions, openCodeSessions, codexSessions] = await Promise.all([
    listClaudeCodeSessions(homeDir),
    listOpenCodeSessions(homeDir),
    listCodexSessions(homeDir),
  ]);

  const allSessions = [...claudeSessions, ...openCodeSessions, ...codexSessions];

  allSessions.sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );

  return allSessions;
}
