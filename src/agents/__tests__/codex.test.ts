import { describe, it, expect } from 'vitest';
import { codexSync } from '../sync/codex';
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

describe('codexSync', () => {
  describe('getRequiredDirs', () => {
    it('returns .codex directory', () => {
      const dirs = codexSync.getRequiredDirs();
      expect(dirs).toContain('/home/workspace/.codex');
    });
  });

  describe('getFilesToSync', () => {
    it('returns auth.json as credential', async () => {
      const context = createMockContext();
      const files = await codexSync.getFilesToSync(context);

      const authFile = files.find((f) => f.source === '~/.codex/auth.json');
      expect(authFile).toBeDefined();
      expect(authFile?.category).toBe('credential');
      expect(authFile?.permissions).toBe('600');
      expect(authFile?.optional).toBe(true);
    });

    it('returns config.toml as preference', async () => {
      const context = createMockContext();
      const files = await codexSync.getFilesToSync(context);

      const configFile = files.find((f) => f.source === '~/.codex/config.toml');
      expect(configFile).toBeDefined();
      expect(configFile?.category).toBe('preference');
      expect(configFile?.permissions).toBe('600');
      expect(configFile?.optional).toBe(true);
    });

    it('marks all files as optional', async () => {
      const context = createMockContext();
      const files = await codexSync.getFilesToSync(context);

      expect(files.every((f) => f.optional === true)).toBe(true);
    });
  });

  describe('getDirectoriesToSync', () => {
    it('returns empty array (no directories to sync)', async () => {
      const context = createMockContext();
      const dirs = await codexSync.getDirectoriesToSync(context);

      expect(dirs).toHaveLength(0);
    });
  });

  describe('getGeneratedConfigs', () => {
    it('returns empty array (no generated configs)', async () => {
      const context = createMockContext();
      const configs = await codexSync.getGeneratedConfigs(context);

      expect(configs).toHaveLength(0);
    });
  });
});
