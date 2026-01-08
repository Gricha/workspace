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

    let mcpServers: Record<string, unknown> = {};

    if (hostConfigContent) {
      try {
        const parsed = JSON.parse(hostConfigContent);
        if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
          mcpServers = parsed.mcpServers;
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    const claudeJson: Record<string, unknown> = {
      hasCompletedOnboarding: true,
    };

    if (Object.keys(mcpServers).length > 0) {
      claudeJson.mcpServers = mcpServers;
    }

    return [
      {
        dest: '/home/workspace/.claude.json',
        content: JSON.stringify(claudeJson, null, 2),
        permissions: '644',
        category: 'preference',
      },
    ];
  },
};
