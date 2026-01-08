import type {
  AgentSyncProvider,
  SyncContext,
  SyncFile,
  SyncDirectory,
  GeneratedConfig,
} from '../types';

export const claudeCodeSync: AgentSyncProvider = {
  getRequiredDirs(): string[] {
    return ['/home/workspace/.claude'];
  },

  async getFilesToSync(_context: SyncContext): Promise<SyncFile[]> {
    return [
      {
        source: '~/.claude/.credentials.json',
        dest: '/home/workspace/.claude/.credentials.json',
        category: 'credential',
        permissions: '600',
        optional: true,
      },
      {
        source: '~/.claude/settings.json',
        dest: '/home/workspace/.claude/settings.json',
        category: 'preference',
        permissions: '644',
        optional: true,
      },
      {
        source: '~/.claude/CLAUDE.md',
        dest: '/home/workspace/.claude/CLAUDE.md',
        category: 'preference',
        permissions: '644',
        optional: true,
      },
    ];
  },

  async getDirectoriesToSync(context: SyncContext): Promise<SyncDirectory[]> {
    const agentsDirExists = await context.hostDirExists('~/.claude/agents');
    if (!agentsDirExists) {
      return [];
    }

    return [
      {
        source: '~/.claude/agents',
        dest: '/home/workspace/.claude/agents',
        category: 'preference',
        optional: true,
      },
    ];
  },

  async getGeneratedConfigs(context: SyncContext): Promise<GeneratedConfig[]> {
    const hostConfigContent = await context.readHostFile('~/.claude.json');
    const containerConfigContent = await context.readContainerFile('/home/workspace/.claude.json');

    let hostMcpServers: Record<string, unknown> = {};
    if (hostConfigContent) {
      try {
        const parsed = JSON.parse(hostConfigContent);
        if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
          hostMcpServers = parsed.mcpServers;
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    let containerConfig: Record<string, unknown> = {};
    if (containerConfigContent) {
      try {
        containerConfig = JSON.parse(containerConfigContent);
      } catch {
        // Invalid JSON, start fresh
      }
    }

    containerConfig.hasCompletedOnboarding = true;

    if (Object.keys(hostMcpServers).length > 0) {
      const existingMcp =
        containerConfig.mcpServers && typeof containerConfig.mcpServers === 'object'
          ? (containerConfig.mcpServers as Record<string, unknown>)
          : {};
      containerConfig.mcpServers = { ...existingMcp, ...hostMcpServers };
    }

    return [
      {
        dest: '/home/workspace/.claude.json',
        content: JSON.stringify(containerConfig, null, 2),
        permissions: '644',
        category: 'preference',
      },
    ];
  },
};
