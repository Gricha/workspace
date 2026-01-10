import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { SessionIndex } from '../../src/worker/session-index';

describe('SessionIndex', () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perry-worker-test-'));
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;

    await fs.mkdir(path.join(tempDir, '.claude', 'projects', 'test-project'), {
      recursive: true,
    });
    await fs.mkdir(path.join(tempDir, '.local', 'share', 'opencode', 'storage', 'session'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('discovers claude sessions from jsonl files', async () => {
    const sessionFile = path.join(
      tempDir,
      '.claude',
      'projects',
      'test-project',
      'test-session-123.jsonl'
    );

    const sessionContent = JSON.stringify({
      type: 'user',
      timestamp: new Date().toISOString(),
      message: {
        content: [{ type: 'text', text: 'Hello, world!' }],
      },
    });
    await fs.writeFile(sessionFile, sessionContent + '\n');

    const index = new SessionIndex();
    await index.initialize();

    const sessions = index.list();
    expect(sessions.length).toBeGreaterThan(0);

    const testSession = sessions.find((s) => s.id === 'test-session-123');
    expect(testSession).toBeDefined();
    expect(testSession?.agentType).toBe('claude');
    expect(testSession?.firstPrompt).toBe('Hello, world!');
  });

  it('returns sessions sorted by lastActivity descending', async () => {
    const projectDir = path.join(tempDir, '.claude', 'projects', 'test-project');

    const session1 = path.join(projectDir, 'session-older.jsonl');
    const session2 = path.join(projectDir, 'session-newer.jsonl');

    await fs.writeFile(
      session1,
      JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'text', text: 'First' }] },
      }) + '\n'
    );

    await new Promise((r) => setTimeout(r, 50));

    await fs.writeFile(
      session2,
      JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'text', text: 'Second' }] },
      }) + '\n'
    );

    const index = new SessionIndex();
    await index.initialize();

    const sessions = index.list();
    const olderIdx = sessions.findIndex((s) => s.id === 'session-older');
    const newerIdx = sessions.findIndex((s) => s.id === 'session-newer');

    expect(newerIdx).toBeLessThan(olderIdx);
  });

  it('skips agent-* files', async () => {
    const projectDir = path.join(tempDir, '.claude', 'projects', 'test-project');

    await fs.writeFile(
      path.join(projectDir, 'agent-internal.jsonl'),
      JSON.stringify({ type: 'user', message: { content: [{ type: 'text', text: 'Skip me' }] } }) +
        '\n'
    );
    await fs.writeFile(
      path.join(projectDir, 'regular-session.jsonl'),
      JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'text', text: 'Include me' }] },
      }) + '\n'
    );

    const index = new SessionIndex();
    await index.initialize();

    const sessions = index.list();
    const agentSession = sessions.find((s) => s.id === 'agent-internal');
    const regularSession = sessions.find((s) => s.id === 'regular-session');

    expect(agentSession).toBeUndefined();
    expect(regularSession).toBeDefined();
  });

  it('skips empty jsonl files', async () => {
    const projectDir = path.join(tempDir, '.claude', 'projects', 'test-project');

    await fs.writeFile(path.join(projectDir, 'empty-session.jsonl'), '');
    await fs.writeFile(
      path.join(projectDir, 'non-empty-session.jsonl'),
      JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'text', text: 'Content' }] },
      }) + '\n'
    );

    const index = new SessionIndex();
    await index.initialize();

    const sessions = index.list();
    const emptySession = sessions.find((s) => s.id === 'empty-session');
    const nonEmptySession = sessions.find((s) => s.id === 'non-empty-session');

    expect(emptySession).toBeUndefined();
    expect(nonEmptySession).toBeDefined();
  });

  it('retrieves messages with pagination', async () => {
    const projectDir = path.join(tempDir, '.claude', 'projects', 'test-project');
    const sessionFile = path.join(projectDir, 'paginated-session.jsonl');

    const messages = [];
    for (let i = 0; i < 10; i++) {
      messages.push(
        JSON.stringify({
          type: 'user',
          timestamp: new Date().toISOString(),
          message: { content: [{ type: 'text', text: `Message ${i}` }] },
        })
      );
    }
    await fs.writeFile(sessionFile, messages.join('\n') + '\n');

    const index = new SessionIndex();
    await index.initialize();

    const result = await index.getMessages('paginated-session', { limit: 3, offset: 0 });
    expect(result.total).toBe(10);
    expect(result.messages.length).toBe(3);
  });

  it('retrieves session by id', async () => {
    const projectDir = path.join(tempDir, '.claude', 'projects', 'test-project');
    await fs.writeFile(
      path.join(projectDir, 'find-me.jsonl'),
      JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'text', text: 'Found!' }] },
      }) + '\n'
    );

    const index = new SessionIndex();
    await index.initialize();

    const session = index.get('find-me');
    expect(session).toBeDefined();
    expect(session?.id).toBe('find-me');
    expect(session?.firstPrompt).toBe('Found!');

    const notFound = index.get('does-not-exist');
    expect(notFound).toBeUndefined();
  });

  it('cleans up watchers on stop', async () => {
    const index = new SessionIndex();
    await index.initialize();
    index.startWatchers();

    index.stopWatchers();
  });
});
