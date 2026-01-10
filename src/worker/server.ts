import { sessionIndex, type IndexedSession, type Message } from './session-index';

const DEFAULT_PORT = 7392;

interface ServerOptions {
  port?: number;
}

interface ListResponse {
  sessions: IndexedSession[];
}

interface MessagesResponse {
  id: string;
  messages: Message[];
  total: number;
}

interface DeleteResponse {
  success: boolean;
  error?: string;
}

interface HealthResponse {
  status: 'ok';
  sessionCount: number;
}

export async function startWorkerServer(options: ServerOptions = {}): Promise<void> {
  const port = options.port ?? DEFAULT_PORT;

  await sessionIndex.initialize();
  sessionIndex.startWatchers();

  const server = Bun.serve({
    port,
    hostname: '0.0.0.0',

    async fetch(req): Promise<Response> {
      const url = new URL(req.url);

      if (url.pathname === '/health' && req.method === 'GET') {
        const response: HealthResponse = {
          status: 'ok',
          sessionCount: sessionIndex.list().length,
        };
        return Response.json(response);
      }

      if (url.pathname === '/sessions' && req.method === 'GET') {
        await sessionIndex.refresh();
        const sessions = sessionIndex.list();
        const response: ListResponse = { sessions };
        return Response.json(response);
      }

      if (url.pathname === '/refresh' && req.method === 'POST') {
        await sessionIndex.refresh();
        return Response.json({ success: true });
      }

      const messagesMatch = url.pathname.match(/^\/sessions\/([^/]+)\/messages$/);
      if (messagesMatch && req.method === 'GET') {
        const id = decodeURIComponent(messagesMatch[1]);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        const result = await sessionIndex.getMessages(id, { limit, offset });
        const response: MessagesResponse = result;
        return Response.json(response);
      }

      const sessionMatch = url.pathname.match(/^\/sessions\/([^/]+)$/);
      if (sessionMatch && req.method === 'GET') {
        const id = decodeURIComponent(sessionMatch[1]);
        const session = sessionIndex.get(id);
        if (!session) {
          return Response.json({ error: 'Session not found' }, { status: 404 });
        }
        return Response.json({ session });
      }

      if (sessionMatch && req.method === 'DELETE') {
        const id = decodeURIComponent(sessionMatch[1]);
        const result = await sessionIndex.delete(id);
        const response: DeleteResponse = result;
        return Response.json(response, { status: result.success ? 200 : 404 });
      }

      return Response.json({ error: 'Not Found' }, { status: 404 });
    },
  });

  console.error(`Worker server listening on port ${server.port}`);

  process.on('SIGINT', () => {
    sessionIndex.stopWatchers();
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    sessionIndex.stopWatchers();
    server.stop();
    process.exit(0);
  });
}
