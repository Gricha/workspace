import type {
  AgentSyncProvider,
  SyncContext,
  SyncFile,
  SyncDirectory,
  GeneratedConfig,
} from '../types';
import type { McpServerDefinition, SkillDefinition } from '../../shared/types';

export const opencodeSync: AgentSyncProvider = {
  getRequiredDirs(): string[] {
    return ['/home/workspace/.config/opencode', '/home/workspace/.claude/skills'];
  },

  async getFilesToSync(_context: SyncContext): Promise<SyncFile[]> {
    return [
      {
        source: '~/.local/share/opencode/auth.json',
        dest: '/home/workspace/.local/share/opencode/auth.json',
        category: 'credential',
        permissions: '600',
        optional: true,
      },
      {
        source: '~/.local/share/opencode/mcp-auth.json',
        dest: '/home/workspace/.local/share/opencode/mcp-auth.json',
        category: 'credential',
        permissions: '600',
        optional: true,
      },
    ];
  },

  async getDirectoriesToSync(_context: SyncContext): Promise<SyncDirectory[]> {
    return [];
  },

  async getGeneratedConfigs(context: SyncContext): Promise<GeneratedConfig[]> {
    const hostConfigContent = await context.readHostFile('~/.config/opencode/opencode.json');

    let config: Record<string, unknown> | null = null;
    let mcpConfig: Record<string, unknown> = {};

    const skills = context.agentConfig.skills || [];
    const enabledSkills = skills.filter(
      (s): s is SkillDefinition =>
        s.enabled && (s.appliesTo === 'all' || s.appliesTo.includes('opencode'))
    );

    const mcpServers = (context.agentConfig.mcpServers || []).filter(
      (s): s is McpServerDefinition => s.enabled
    );
    if (hostConfigContent) {
      try {
        const parsed = JSON.parse(hostConfigContent);
        if (parsed.mcp && typeof parsed.mcp === 'object') {
          mcpConfig = parsed.mcp;
        }
        config = parsed;
      } catch {
        config = null;
      }
    }

    const perryMcp: Record<string, unknown> = {};

    for (const server of mcpServers) {
      const safeName = server.name.trim();
      if (!safeName) continue;

      if (server.type === 'remote') {
        const url = server.url?.trim();
        if (!url) continue;
        perryMcp[safeName] = {
          type: 'remote',
          url,
          enabled: true,
          headers: server.headers || {},
          oauth: server.oauth,
        };
        continue;
      }

      const command = server.command?.trim();
      const args = server.args || [];
      if (!command) continue;

      perryMcp[safeName] = {
        type: 'local',
        command: [command, ...args],
        enabled: true,
        environment: server.env || {},
      };
    }

    if (Object.keys(perryMcp).length > 0) {
      mcpConfig = { ...mcpConfig, ...perryMcp };
    }

    // Write skills into OpenCode-discoverable directories.
    const skillConfigs: GeneratedConfig[] = enabledSkills.map((skill) => ({
      dest: `/home/workspace/.claude/skills/${skill.name}/SKILL.md`,
      content: skill.skillMd,
      permissions: '644',
      category: 'preference',
    }));

    if (Object.keys(mcpConfig).length > 0) {
      config = config || {};
      config.mcp = mcpConfig;
    }

    const generated: GeneratedConfig[] = [...skillConfigs];

    if (config) {
      generated.unshift({
        dest: '/home/workspace/.config/opencode/opencode.json',
        content: JSON.stringify(config, null, 2),
        permissions: '600',
        category: 'credential',
      });
    }

    return generated;
  },
};
