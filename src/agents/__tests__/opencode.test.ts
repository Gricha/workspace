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
    it('returns empty array (no files to copy)', async () => {
      const context = createMockContext();
      const files = await opencodeSync.getFilesToSync(context);

      expect(files).toHaveLength(0);
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
    it('returns empty when no zen_token configured', async () => {
      const context = createMockContext();

      const configs = await opencodeSync.getGeneratedConfigs(context);
      expect(configs).toHaveLength(0);
    });

    it('generates config with provider when zen_token is set', async () => {
      const context = createMockContext({
        agentConfig: {
          port: 7777,
          credentials: { env: {}, files: {} },
          scripts: {},
          agents: {
            opencode: {
              zen_token: 'test-token-123',
            },
          },
        },
      });

      const configs = await opencodeSync.getGeneratedConfigs(context);

      expect(configs).toHaveLength(1);
      expect(configs[0].dest).toBe('/home/workspace/.config/opencode/opencode.json');
      expect(configs[0].category).toBe('credential');
      expect(configs[0].permissions).toBe('600');

      const parsed = JSON.parse(configs[0].content);
      expect(parsed.provider.opencode.options.apiKey).toBe('test-token-123');
      expect(parsed.model).toBe('opencode/claude-sonnet-4');
    });

    it('does not include mcp when host has none', async () => {
      const context = createMockContext({
        agentConfig: {
          port: 7777,
          credentials: { env: {}, files: {} },
          scripts: {},
          agents: { opencode: { zen_token: 'test-token' } },
        },
      });

      const configs = await opencodeSync.getGeneratedConfigs(context);
      const parsed = JSON.parse(configs[0].content);

      expect(parsed.mcp).toBeUndefined();
    });

    it('merges mcp config from host', async () => {
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
          agents: { opencode: { zen_token: 'test-token' } },
        },
        readHostFile: async (path) =>
          path === '~/.config/opencode/opencode.json' ? JSON.stringify(hostConfig) : null,
      });

      const configs = await opencodeSync.getGeneratedConfigs(context);
      const parsed = JSON.parse(configs[0].content);

      expect(parsed.mcp).toEqual(hostConfig.mcp);
    });

    it('handles invalid JSON in host config gracefully', async () => {
      const context = createMockContext({
        agentConfig: {
          port: 7777,
          credentials: { env: {}, files: {} },
          scripts: {},
          agents: { opencode: { zen_token: 'test-token' } },
        },
        readHostFile: async (path) =>
          path === '~/.config/opencode/opencode.json' ? 'not valid json' : null,
      });

      const configs = await opencodeSync.getGeneratedConfigs(context);
      const parsed = JSON.parse(configs[0].content);

      expect(parsed.provider.opencode.options.apiKey).toBe('test-token');
      expect(parsed.mcp).toBeUndefined();
    });

    it('handles empty mcp object', async () => {
      const hostConfig = { mcp: {} };

      const context = createMockContext({
        agentConfig: {
          port: 7777,
          credentials: { env: {}, files: {} },
          scripts: {},
          agents: { opencode: { zen_token: 'test-token' } },
        },
        readHostFile: async (path) =>
          path === '~/.config/opencode/opencode.json' ? JSON.stringify(hostConfig) : null,
      });

      const configs = await opencodeSync.getGeneratedConfigs(context);
      const parsed = JSON.parse(configs[0].content);

      expect(parsed.mcp).toBeUndefined();
    });
  });
});
