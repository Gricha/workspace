import { describe, it, expect } from 'vitest';
import { opencodeSync } from '../sync/opencode';
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

describe('opencodeSync', () => {
  describe('getRequiredDirs', () => {
    it('returns opencode config directory', () => {
      const dirs = opencodeSync.getRequiredDirs();
      expect(dirs).toContain('/home/workspace/.config/opencode');
    });
  });

  describe('getFilesToSync', () => {
    it('returns auth files to copy', async () => {
      const context = createMockContext();
      const files = await opencodeSync.getFilesToSync(context);

      expect(files).toEqual([
        {
          source: '~/.local/share/opencode/auth.json',
          dest: '/home/workspace/.local/share/opencode/auth.json',
          permissions: '600',
          optional: true,
        },
        {
          source: '~/.local/share/opencode/mcp-auth.json',
          dest: '/home/workspace/.local/share/opencode/mcp-auth.json',
          permissions: '600',
          optional: true,
        },
      ]);
    });
  });

  describe('getDirectoriesToSync', () => {
    it('returns empty array (no directories to copy)', async () => {
      const context = createMockContext();
      const dirs = await opencodeSync.getDirectoriesToSync(context);

      expect(dirs).toHaveLength(0);
    });
  });

  describe('getGeneratedConfigs', () => {
    it('returns empty when no host config and no perry config', async () => {
      const context = createMockContext();

      const configs = await opencodeSync.getGeneratedConfigs(context);
      expect(configs).toHaveLength(0);
    });

    it('writes host config when present', async () => {
      const hostConfig = { model: 'opencode/claude-opus-4-5', provider: { test: true } };

      const context = createMockContext({
        readHostFile: async (path) =>
          path === '~/.config/opencode/opencode.json' ? JSON.stringify(hostConfig) : null,
      });

      const configs = await opencodeSync.getGeneratedConfigs(context);
      expect(configs).toHaveLength(1);
      expect(configs[0].dest).toBe('/home/workspace/.config/opencode/opencode.json');
      expect(JSON.parse(configs[0].content)).toEqual(hostConfig);
    });

    it('merges mcp config from host and perry', async () => {
      const hostConfig = {
        mcp: {
          'my-mcp': { type: 'local', command: ['bun', 'run', 'server'] },
        },
      };

      const context = createMockContext({
        agentConfig: {
          port: 7777,
          credentials: { env: {}, files: {} },
          scripts: {},
          mcpServers: [
            {
              id: 'remote-1',
              name: 'remote_server',
              enabled: true,
              type: 'remote',
              url: 'https://example.com/mcp',
              headers: { Authorization: 'Bearer {env:API_KEY}' },
              oauth: false,
            },
          ],
        },
        readHostFile: async (path) =>
          path === '~/.config/opencode/opencode.json' ? JSON.stringify(hostConfig) : null,
      });

      const configs = await opencodeSync.getGeneratedConfigs(context);
      const parsed = JSON.parse(configs[0].content);

      expect(parsed.mcp).toMatchObject({
        ...hostConfig.mcp,
        remote_server: {
          type: 'remote',
          url: 'https://example.com/mcp',
          enabled: true,
          headers: { Authorization: 'Bearer {env:API_KEY}' },
          oauth: false,
        },
      });
    });

    it('ignores invalid host config when no perry config', async () => {
      const context = createMockContext({
        readHostFile: async (path) =>
          path === '~/.config/opencode/opencode.json' ? 'not valid json' : null,
      });

      const configs = await opencodeSync.getGeneratedConfigs(context);
      expect(configs).toHaveLength(0);
    });

    it('renders local and remote MCP servers with auth', async () => {
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
              oauth: false,
            },
          ],
        },
      });

      const configs = await opencodeSync.getGeneratedConfigs(context);
      const parsed = JSON.parse(configs[0].content);

      expect(parsed.mcp).toMatchObject({
        local_server: {
          type: 'local',
          command: ['npx', '-y', 'my-local-mcp'],
          enabled: true,
          environment: { FOO: 'bar' },
        },
        remote_server: {
          type: 'remote',
          url: 'https://example.com/mcp',
          enabled: true,
          headers: { Authorization: 'Bearer {env:API_KEY}' },
          oauth: false,
        },
      });
    });
  });
});
