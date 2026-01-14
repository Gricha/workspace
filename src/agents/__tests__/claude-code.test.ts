import { describe, it, expect } from 'vitest';
import { claudeCodeSync } from '../sync/claude-code';
import type { SyncContext } from '../types';

function createMockContext(overrides: Partial<SyncContext> = {}): SyncContext {
  return {
    containerName: 'test-container',
    agentConfig: {
      port: 7777,
      credentials: { env: {}, files: {} },
      scripts: {},
    },
    hostFileExists: async () => false,
    hostDirExists: async () => false,
    readHostFile: async () => null,
    readContainerFile: async () => null,
    ...overrides,
  };
}

describe('claudeCodeSync', () => {
  describe('getRequiredDirs', () => {
    it('returns .claude directory', () => {
      const dirs = claudeCodeSync.getRequiredDirs();
      expect(dirs).toContain('/home/workspace/.claude');
    });
  });

  describe('getFilesToSync', () => {
    it('returns credentials file', async () => {
      const context = createMockContext();
      const files = await claudeCodeSync.getFilesToSync(context);

      const credFile = files.find((f) => f.source === '~/.claude/.credentials.json');
      expect(credFile).toBeDefined();
      expect(credFile?.category).toBe('credential');
      expect(credFile?.permissions).toBe('600');
      expect(credFile?.optional).toBe(true);
    });

    it('returns settings file', async () => {
      const context = createMockContext();
      const files = await claudeCodeSync.getFilesToSync(context);

      const settingsFile = files.find((f) => f.source === '~/.claude/settings.json');
      expect(settingsFile).toBeDefined();
      expect(settingsFile?.category).toBe('preference');
      expect(settingsFile?.optional).toBe(true);
    });

    it('returns CLAUDE.md file', async () => {
      const context = createMockContext();
      const files = await claudeCodeSync.getFilesToSync(context);

      const claudeMdFile = files.find((f) => f.source === '~/.claude/CLAUDE.md');
      expect(claudeMdFile).toBeDefined();
      expect(claudeMdFile?.category).toBe('preference');
      expect(claudeMdFile?.optional).toBe(true);
    });

    it('marks all files as optional', async () => {
      const context = createMockContext();
      const files = await claudeCodeSync.getFilesToSync(context);

      expect(files.every((f) => f.optional === true)).toBe(true);
    });
  });

  describe('getDirectoriesToSync', () => {
    it('returns empty when agents dir does not exist', async () => {
      const context = createMockContext({
        hostDirExists: async () => false,
      });

      const dirs = await claudeCodeSync.getDirectoriesToSync(context);
      expect(dirs).toHaveLength(0);
    });

    it('returns agents directory when it exists', async () => {
      const context = createMockContext({
        hostDirExists: async (path) => path === '~/.claude/agents',
      });

      const dirs = await claudeCodeSync.getDirectoriesToSync(context);
      expect(dirs).toHaveLength(1);
      expect(dirs[0].source).toBe('~/.claude/agents');
      expect(dirs[0].dest).toBe('/home/workspace/.claude/agents');
      expect(dirs[0].category).toBe('preference');
    });
  });

  describe('getGeneratedConfigs', () => {
    it('generates .claude.json with onboarding flag', async () => {
      const context = createMockContext();

      const configs = await claudeCodeSync.getGeneratedConfigs(context);

      expect(configs).toHaveLength(1);
      expect(configs[0].dest).toBe('/home/workspace/.claude.json');
      expect(configs[0].category).toBe('preference');

      const parsed = JSON.parse(configs[0].content);
      expect(parsed.hasCompletedOnboarding).toBe(true);
    });

    it('does not include mcpServers when host has none', async () => {
      const context = createMockContext();

      const configs = await claudeCodeSync.getGeneratedConfigs(context);
      const parsed = JSON.parse(configs[0].content);

      expect(parsed.mcpServers).toBeUndefined();
    });

    it('merges mcpServers from host config', async () => {
      const hostConfig = {
        mcpServers: {
          'my-server': { command: 'node', args: ['server.js'] },
        },
      };

      const context = createMockContext({
        readHostFile: async (path) =>
          path === '~/.claude.json' ? JSON.stringify(hostConfig) : null,
      });

      const configs = await claudeCodeSync.getGeneratedConfigs(context);
      const parsed = JSON.parse(configs[0].content);

      expect(parsed.mcpServers).toEqual(hostConfig.mcpServers);
      expect(parsed.hasCompletedOnboarding).toBe(true);
    });

    it('handles invalid JSON in host config gracefully', async () => {
      const context = createMockContext({
        readHostFile: async (path) => (path === '~/.claude.json' ? 'invalid json{' : null),
      });

      const configs = await claudeCodeSync.getGeneratedConfigs(context);
      const parsed = JSON.parse(configs[0].content);

      expect(parsed.hasCompletedOnboarding).toBe(true);
      expect(parsed.mcpServers).toBeUndefined();
    });

    it('handles empty mcpServers object', async () => {
      const hostConfig = { mcpServers: {} };

      const context = createMockContext({
        readHostFile: async (path) =>
          path === '~/.claude.json' ? JSON.stringify(hostConfig) : null,
      });

      const configs = await claudeCodeSync.getGeneratedConfigs(context);
      const parsed = JSON.parse(configs[0].content);

      expect(parsed.mcpServers).toBeUndefined();
    });

    it('renders local and remote MCP servers', async () => {
      const context = createMockContext({
        agentConfig: {
          port: 7777,
          credentials: { env: {}, files: {} },
          scripts: {},
          mcpServers: [
            {
              id: 'local-1',
              name: 'local_server',
              enabled: true,
              type: 'local',
              command: 'npx',
              args: ['-y', 'my-local-mcp'],
              env: { FOO: 'bar' },
            },
            {
              id: 'remote-1',
              name: 'remote_server',
              enabled: true,
              type: 'remote',
              url: 'https://example.com/mcp',
              headers: { Authorization: 'Bearer {env:API_KEY}' },
            },
          ],
        },
      });

      const configs = await claudeCodeSync.getGeneratedConfigs(context);
      const parsed = JSON.parse(configs[0].content);

      expect(parsed.mcpServers).toMatchObject({
        local_server: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', 'my-local-mcp'],
          env: { FOO: 'bar' },
        },
        remote_server: {
          type: 'http',
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer {env:API_KEY}' },
        },
      });
    });
  });
});
