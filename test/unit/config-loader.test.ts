import { describe, it, expect } from 'vitest';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { loadAgentConfig } from '../../src/config/loader';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perry-config-'));
  try {
    return await fn(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

describe('loadAgentConfig', () => {
  it('overrides tailscale auth key from environment', async () => {
    const previous = process.env.PERRY_TAILSCALE_AUTH_KEY;
    process.env.PERRY_TAILSCALE_AUTH_KEY = 'env-key';

    try {
      await withTempDir(async (dir) => {
        const configPath = path.join(dir, 'config.json');
        await fs.writeFile(
          configPath,
          JSON.stringify({ tailscale: { enabled: false, authKey: 'config-key' } }, null, 2),
          'utf-8'
        );

        const config = await loadAgentConfig(dir);

        expect(config.tailscale?.authKey).toBe('env-key');
        expect(config.tailscale?.enabled).toBe(true);
      });
    } finally {
      if (previous === undefined) {
        delete process.env.PERRY_TAILSCALE_AUTH_KEY;
      } else {
        process.env.PERRY_TAILSCALE_AUTH_KEY = previous;
      }
    }
  });

  it('uses config tailscale auth key when env is not set', async () => {
    const previous = process.env.PERRY_TAILSCALE_AUTH_KEY;
    delete process.env.PERRY_TAILSCALE_AUTH_KEY;

    try {
      await withTempDir(async (dir) => {
        const configPath = path.join(dir, 'config.json');
        await fs.writeFile(
          configPath,
          JSON.stringify({ tailscale: { enabled: true, authKey: 'config-key' } }, null, 2),
          'utf-8'
        );

        const config = await loadAgentConfig(dir);

        expect(config.tailscale?.authKey).toBe('config-key');
        expect(config.tailscale?.enabled).toBe(true);
      });
    } finally {
      if (previous === undefined) {
        delete process.env.PERRY_TAILSCALE_AUTH_KEY;
      } else {
        process.env.PERRY_TAILSCALE_AUTH_KEY = previous;
      }
    }
  });
});
