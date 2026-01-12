import { WebSocket } from 'ws';
import { BaseWebSocketServer, type BaseConnection, safeSend } from '../shared/base-websocket';
import { sessionManager } from './manager';
import type { ChatMessage } from '../chat/types';
import type { AgentType } from './types';
import { HOST_WORKSPACE_NAME } from '../shared/client-types';

interface LiveChatMessage {
  type: 'message' | 'interrupt' | 'connect' | 'disconnect';
  content?: string;
  sessionId?: string;
  agentSessionId?: string;
  agentType?: AgentType;
  model?: string;
  projectPath?: string;
  resumeFromId?: number;
}

interface LiveChatConnection extends BaseConnection {
  sessionId: string | null;
  clientId: string | null;
  agentType: AgentType;
}

export interface LiveChatWebSocketOptions {
  isWorkspaceRunning: (workspaceName: string) => Promise<boolean>;
  isHostAccessAllowed?: () => boolean;
  agentType: AgentType;
}

export class LiveChatWebSocketServer extends BaseWebSocketServer<LiveChatConnection> {
  protected isHostAccessAllowed: () => boolean;
  private agentType: AgentType;

  constructor(options: LiveChatWebSocketOptions) {
    super(options);
    this.isHostAccessAllowed = options.isHostAccessAllowed || (() => false);
    this.agentType = options.agentType;
  }

  protected handleConnection(ws: WebSocket, workspaceName: string): void {
    const isHostMode = workspaceName === HOST_WORKSPACE_NAME;

    if (isHostMode && !this.isHostAccessAllowed()) {
      ws.close(4003, 'Host access is disabled');
      return;
    }

    const connection: LiveChatConnection = {
      ws,
      workspaceName,
      sessionId: null,
      clientId: null,
      agentType: this.agentType,
    };
    this.connections.set(ws, connection);

    safeSend(
      ws,
      JSON.stringify({
        type: 'connected',
        workspaceName,
        agentType: this.agentType,
        timestamp: new Date().toISOString(),
      })
    );

    ws.on('message', (data: Buffer | string) => {
      const str = typeof data === 'string' ? data : data.toString();

      const handleMessage = async () => {
        const message: LiveChatMessage = JSON.parse(str);

        if (message.type === 'connect') {
          await this.handleConnect(connection, ws, workspaceName, message);
          return;
        }

        if (message.type === 'disconnect') {
          this.handleDisconnect(connection);
          return;
        }

        if (message.type === 'interrupt') {
          if (connection.sessionId) {
            await sessionManager.interrupt(connection.sessionId);
          }
          return;
        }

        if (message.type === 'message' && message.content) {
          await this.handleMessage(connection, ws, workspaceName, message);
        }
      };

      handleMessage().catch((err) => {
        safeSend(
          ws,
          JSON.stringify({
            type: 'error',
            content: (err as Error).message,
            timestamp: new Date().toISOString(),
          })
        );
      });
    });

    ws.on('close', () => {
      this.handleDisconnect(connection);
      this.connections.delete(ws);
    });

    ws.on('error', (err) => {
      console.error(`Live chat WebSocket error:`, err);
      this.handleDisconnect(connection);
      this.connections.delete(ws);
    });
  }

  private async handleConnect(
    connection: LiveChatConnection,
    ws: WebSocket,
    workspaceName: string,
    message: LiveChatMessage
  ): Promise<void> {
    const agentType = message.agentType || this.agentType;

    if (message.sessionId) {
      const found = await sessionManager.findSession(message.sessionId);
      if (found) {
        connection.sessionId = found.sessionId;

        const sendFn = (msg: ChatMessage) => {
          safeSend(ws, JSON.stringify(msg));
        };

        const clientId = sessionManager.connectClient(found.sessionId, sendFn, {
          resumeFromId: message.resumeFromId,
        });

        if (clientId) {
          connection.clientId = clientId;
          safeSend(
            ws,
            JSON.stringify({
              type: 'session_joined',
              sessionId: found.sessionId,
              status: found.info.status,
              agentSessionId: found.info.agentSessionId,
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }
      }
    }

    const sessionId = await sessionManager.startSession({
      workspaceName,
      agentType,
      sessionId: message.sessionId,
      agentSessionId: message.agentSessionId,
      model: message.model,
      projectPath: message.projectPath,
    });

    connection.sessionId = sessionId;

    const sendFn = (msg: ChatMessage) => {
      safeSend(ws, JSON.stringify(msg));
    };

    const clientId = sessionManager.connectClient(sessionId, sendFn);
    connection.clientId = clientId;

    safeSend(
      ws,
      JSON.stringify({
        type: 'session_started',
        sessionId,
        timestamp: new Date().toISOString(),
      })
    );
  }

  private async handleMessage(
    connection: LiveChatConnection,
    ws: WebSocket,
    workspaceName: string,
    message: LiveChatMessage
  ): Promise<void> {
    if (!connection.sessionId) {
      await this.handleConnect(connection, ws, workspaceName, {
        type: 'connect',
        agentType: message.agentType || this.agentType,
        agentSessionId: message.agentSessionId,
        model: message.model,
        projectPath: message.projectPath,
      });
    }

    if (!connection.sessionId) {
      throw new Error('Failed to create session');
    }

    await sessionManager.sendMessage(connection.sessionId, message.content!);
  }

  private handleDisconnect(connection: LiveChatConnection): void {
    if (connection.sessionId && connection.clientId) {
      sessionManager.disconnectClient(connection.sessionId, connection.clientId);
      connection.clientId = null;
    }
  }

  protected cleanupConnection(connection: LiveChatConnection): void {
    this.handleDisconnect(connection);
  }

  closeConnectionsForWorkspace(workspaceName: string): void {
    for (const [ws, connection] of this.connections) {
      if (connection.workspaceName === workspaceName) {
        this.handleDisconnect(connection);
        ws.close(1001, 'Workspace stopped');
        this.connections.delete(ws);
      }
    }
  }
}

export function createLiveChatWebSocketServer(
  options: LiveChatWebSocketOptions
): LiveChatWebSocketServer {
  return new LiveChatWebSocketServer(options);
}
