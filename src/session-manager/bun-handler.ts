import type { ServerWebSocket } from 'bun';
import { sessionManager } from './manager';
import type { ChatMessage } from '../chat/types';
import type { AgentType } from './types';
import { HOST_WORKSPACE_NAME } from '../shared/client-types';

interface LiveChatMessage {
  type: 'message' | 'interrupt' | 'connect' | 'disconnect' | 'set_model';
  content?: string;
  sessionId?: string;
  agentSessionId?: string;
  agentType?: AgentType;
  model?: string;
  projectPath?: string;
  resumeFromId?: number;
}

interface LiveChatConnection {
  ws: ServerWebSocket<unknown>;
  workspaceName: string;
  sessionId: string | null;
  clientId: string | null;
  agentType: AgentType;
}

export interface LiveChatHandlerOptions {
  isWorkspaceRunning: (workspaceName: string) => Promise<boolean>;
  isHostAccessAllowed?: () => boolean;
  agentType: AgentType;
}

function safeSend(ws: ServerWebSocket<unknown>, data: string): boolean {
  try {
    ws.send(data);
    return true;
  } catch {
    return false;
  }
}

export class LiveChatHandler {
  private connections: Map<ServerWebSocket<unknown>, LiveChatConnection> = new Map();
  private isHostAccessAllowed: () => boolean;
  private agentType: AgentType;

  constructor(options: LiveChatHandlerOptions) {
    this.isHostAccessAllowed = options.isHostAccessAllowed || (() => false);
    this.agentType = options.agentType;
  }

  handleOpen(ws: ServerWebSocket<unknown>, workspaceName: string): void {
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
  }

  async handleMessage(ws: ServerWebSocket<unknown>, data: string): Promise<void> {
    const connection = this.connections.get(ws);
    if (!connection) return;

    try {
      const message: LiveChatMessage = JSON.parse(data);

      if (message.type === 'connect') {
        await this.handleConnect(connection, message);
        return;
      }

      if (message.type === 'disconnect') {
        this.handleDisconnect(connection);
        return;
      }

      if (message.type === 'set_model') {
        if (!connection.sessionId) {
          throw new Error('No active session to set model for');
        }
        if (!message.model) {
          throw new Error('Missing model');
        }
        sessionManager.setModel(connection.sessionId, message.model);
        safeSend(
          ws,
          JSON.stringify({
            type: 'system',
            content: `Model set to: ${message.model}`,
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }

      if (message.type === 'interrupt') {
        if (connection.sessionId) {
          await sessionManager.interrupt(connection.sessionId);
        }
        return;
      }

      if (message.type === 'message' && message.content) {
        await this.handleChatMessage(connection, message);
      }
    } catch (err) {
      safeSend(
        ws,
        JSON.stringify({
          type: 'error',
          content: (err as Error).message,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  handleClose(ws: ServerWebSocket<unknown>, _code: number, _reason: string): void {
    const connection = this.connections.get(ws);
    if (connection) {
      this.handleDisconnect(connection);
    }
    this.connections.delete(ws);
  }

  handleError(ws: ServerWebSocket<unknown>, error: Error): void {
    console.error('Live chat WebSocket error:', error);
    const connection = this.connections.get(ws);
    if (connection) {
      this.handleDisconnect(connection);
    }
    this.connections.delete(ws);
  }

  private async handleConnect(
    connection: LiveChatConnection,
    message: LiveChatMessage
  ): Promise<void> {
    const { ws, workspaceName } = connection;
    const agentType = message.agentType || this.agentType;

    if (message.sessionId) {
      // Look up by internal sessionId or agentSessionId (Claude session ID)
      const found = await sessionManager.findSession(message.sessionId, {
        projectPath: message.projectPath,
      });
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

  private async handleChatMessage(
    connection: LiveChatConnection,
    message: LiveChatMessage
  ): Promise<void> {
    if (!connection.sessionId) {
      await this.handleConnect(connection, {
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

    if (message.model) {
      sessionManager.setModel(connection.sessionId, message.model);
    }
    await sessionManager.sendMessage(connection.sessionId, message.content!);
  }

  private handleDisconnect(connection: LiveChatConnection): void {
    if (connection.sessionId && connection.clientId) {
      sessionManager.disconnectClient(connection.sessionId, connection.clientId);
      connection.clientId = null;
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
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

  close(): void {
    for (const [ws, connection] of this.connections.entries()) {
      this.handleDisconnect(connection);
      ws.close(1001, 'Server shutting down');
    }
    this.connections.clear();
  }
}
