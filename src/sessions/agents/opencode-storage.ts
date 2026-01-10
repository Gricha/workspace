import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

export interface OpencodeSessionInfo {
  id: string;
  title: string;
  directory: string;
  mtime: number;
  file: string;
  messageCount: number;
}

export interface OpencodeMessage {
  type: string;
  content?: string;
  toolName?: string;
  toolId?: string;
  toolInput?: string;
  timestamp?: string;
}

export interface OpencodeSessionMessages {
  id: string;
  messages: OpencodeMessage[];
}

function getStorageBase(homeDir?: string): string {
  const home = homeDir || os.homedir();
  return path.join(home, '.local', 'share', 'opencode', 'storage');
}

export async function listOpencodeSessions(homeDir?: string): Promise<OpencodeSessionInfo[]> {
  const storageBase = getStorageBase(homeDir);
  const sessionDir = path.join(storageBase, 'session');
  const messageDir = path.join(storageBase, 'message');
  const sessions: OpencodeSessionInfo[] = [];

  try {
    const projectDirs = await fs.readdir(sessionDir, { withFileTypes: true });

    for (const projectDir of projectDirs) {
      if (!projectDir.isDirectory()) continue;

      const projectPath = path.join(sessionDir, projectDir.name);
      const sessionFiles = await fs.readdir(projectPath);

      for (const sessionFile of sessionFiles) {
        if (!sessionFile.startsWith('ses_') || !sessionFile.endsWith('.json')) continue;

        const filePath = path.join(projectPath, sessionFile);
        try {
          const stat = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          if (!data.id) continue;

          let messageCount = 0;
          try {
            const msgDir = path.join(messageDir, data.id);
            const msgFiles = await fs.readdir(msgDir);
            messageCount = msgFiles.filter(
              (f) => f.startsWith('msg_') && f.endsWith('.json')
            ).length;
          } catch {
            // No messages directory
          }

          sessions.push({
            id: data.id,
            title: data.title || '',
            directory: data.directory || '',
            mtime: data.time?.updated || Math.floor(stat.mtimeMs),
            file: filePath,
            messageCount,
          });
        } catch {
          continue;
        }
      }
    }
  } catch {
    // Storage doesn't exist
  }

  return sessions;
}

export async function getOpencodeSessionMessages(
  sessionId: string,
  homeDir?: string
): Promise<OpencodeSessionMessages> {
  const storageBase = getStorageBase(homeDir);
  const sessionDir = path.join(storageBase, 'session');
  const messageDir = path.join(storageBase, 'message');
  const partDir = path.join(storageBase, 'part');

  const sessionFile = await findSessionFile(sessionDir, sessionId);
  if (!sessionFile) {
    return { id: sessionId, messages: [] };
  }

  let internalId: string;
  try {
    const content = await fs.readFile(sessionFile, 'utf-8');
    const data = JSON.parse(content);
    internalId = data.id;
    if (!internalId) {
      return { id: sessionId, messages: [] };
    }
  } catch {
    return { id: sessionId, messages: [] };
  }

  const msgDir = path.join(messageDir, internalId);
  const messages: OpencodeMessage[] = [];

  try {
    const msgFiles = (await fs.readdir(msgDir))
      .filter((f) => f.startsWith('msg_') && f.endsWith('.json'))
      .sort();

    for (const msgFile of msgFiles) {
      const msgPath = path.join(msgDir, msgFile);
      try {
        const content = await fs.readFile(msgPath, 'utf-8');
        const msg = JSON.parse(content);

        if (!msg.id || (msg.role !== 'user' && msg.role !== 'assistant')) continue;

        const partMsgDir = path.join(partDir, msg.id);
        try {
          const partFiles = (await fs.readdir(partMsgDir))
            .filter((f) => f.startsWith('prt_') && f.endsWith('.json'))
            .sort();

          for (const partFile of partFiles) {
            const partPath = path.join(partMsgDir, partFile);
            try {
              const partContent = await fs.readFile(partPath, 'utf-8');
              const part = JSON.parse(partContent);
              const timestamp = msg.time?.created
                ? new Date(msg.time.created).toISOString()
                : undefined;

              if (part.type === 'text' && part.text) {
                messages.push({
                  type: msg.role,
                  content: part.text,
                  timestamp,
                });
              } else if (part.type === 'tool') {
                const toolName = part.state?.title || part.tool || '';
                const callId = part.callID || part.id || '';

                messages.push({
                  type: 'tool_use',
                  toolName,
                  toolId: callId,
                  toolInput: part.state?.input ? JSON.stringify(part.state.input) : '',
                  timestamp,
                });

                if (part.state?.output) {
                  messages.push({
                    type: 'tool_result',
                    content: part.state.output,
                    toolId: callId,
                    timestamp,
                  });
                }
              }
            } catch {
              continue;
            }
          }
        } catch {
          continue;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // No messages
  }

  return { id: sessionId, messages };
}

async function findSessionFile(sessionDir: string, sessionId: string): Promise<string | null> {
  try {
    const projectDirs = await fs.readdir(sessionDir, { withFileTypes: true });

    for (const projectDir of projectDirs) {
      if (!projectDir.isDirectory()) continue;

      const filePath = path.join(sessionDir, projectDir.name, `${sessionId}.json`);
      try {
        await fs.access(filePath);
        return filePath;
      } catch {
        continue;
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return null;
}

export async function deleteOpencodeSession(
  sessionId: string,
  homeDir?: string
): Promise<{ success: boolean; error?: string }> {
  const storageBase = getStorageBase(homeDir);
  const sessionDir = path.join(storageBase, 'session');
  const messageDir = path.join(storageBase, 'message');
  const partDir = path.join(storageBase, 'part');

  const sessionFile = await findSessionFile(sessionDir, sessionId);
  if (!sessionFile) {
    return { success: false, error: 'Session not found' };
  }

  let internalId: string | null = null;
  try {
    const content = await fs.readFile(sessionFile, 'utf-8');
    const data = JSON.parse(content);
    internalId = data.id;
  } catch {
    // Continue with session file deletion only
  }

  try {
    await fs.unlink(sessionFile);
  } catch (err) {
    return { success: false, error: `Failed to delete session file: ${err}` };
  }

  if (internalId) {
    const msgDir = path.join(messageDir, internalId);
    try {
      const msgFiles = await fs.readdir(msgDir);
      for (const msgFile of msgFiles) {
        if (!msgFile.startsWith('msg_') || !msgFile.endsWith('.json')) continue;
        const msgPath = path.join(msgDir, msgFile);
        try {
          const content = await fs.readFile(msgPath, 'utf-8');
          const msg = JSON.parse(content);
          if (msg.id) {
            const partMsgDir = path.join(partDir, msg.id);
            try {
              await fs.rm(partMsgDir, { recursive: true });
            } catch {
              // Parts may not exist
            }
          }
        } catch {
          // Skip malformed messages
        }
      }
      await fs.rm(msgDir, { recursive: true });
    } catch {
      // Messages directory may not exist
    }
  }

  return { success: true };
}
