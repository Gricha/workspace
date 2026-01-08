import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import * as docker from '../../docker';
import { expandPath } from '../../config/loader';
import type { SyncFile, SyncDirectory, GeneratedConfig } from '../types';
import type { FileCopier } from './types';

export function createDockerFileCopier(): FileCopier {
  return {
    async ensureDir(containerName: string, dir: string): Promise<void> {
      await docker.execInContainer(containerName, ['mkdir', '-p', dir], {
        user: 'workspace',
      });
    },

    async copyFile(containerName: string, file: SyncFile): Promise<void> {
      const expandedSource = expandPath(file.source);
      const permissions = file.permissions || '644';

      const destDir = path.dirname(file.dest);
      await docker.execInContainer(containerName, ['mkdir', '-p', destDir], {
        user: 'workspace',
      });

      await docker.copyToContainer(containerName, expandedSource, file.dest);
      await docker.execInContainer(containerName, ['chown', 'workspace:workspace', file.dest], {
        user: 'root',
      });
      await docker.execInContainer(containerName, ['chmod', permissions, file.dest], {
        user: 'workspace',
      });
    },

    async copyDirectory(containerName: string, dir: SyncDirectory): Promise<void> {
      const expandedSource = expandPath(dir.source);
      const tempTar = path.join(os.tmpdir(), `agent-sync-${Date.now()}.tar`);

      try {
        const { execSync } = await import('child_process');
        execSync(`tar -cf "${tempTar}" -C "${expandedSource}" .`, { stdio: 'pipe' });

        await docker.execInContainer(containerName, ['mkdir', '-p', dir.dest], {
          user: 'workspace',
        });
        await docker.copyToContainer(containerName, tempTar, '/tmp/agent-sync.tar');
        await docker.execInContainer(
          containerName,
          ['tar', '-xf', '/tmp/agent-sync.tar', '-C', dir.dest],
          { user: 'workspace' }
        );
        await docker.execInContainer(containerName, ['rm', '/tmp/agent-sync.tar'], {
          user: 'workspace',
        });
        await docker.execInContainer(
          containerName,
          ['find', dir.dest, '-type', 'f', '-exec', 'chmod', '644', '{}', '+'],
          { user: 'workspace' }
        );
        await docker.execInContainer(
          containerName,
          ['find', dir.dest, '-type', 'd', '-exec', 'chmod', '755', '{}', '+'],
          { user: 'workspace' }
        );
      } finally {
        await fs.unlink(tempTar).catch(() => {});
      }
    },

    async writeConfig(containerName: string, config: GeneratedConfig): Promise<void> {
      const tempFile = path.join(os.tmpdir(), `agent-config-${Date.now()}.json`);
      const permissions = config.permissions || '644';

      await fs.writeFile(tempFile, config.content, 'utf-8');

      try {
        const destDir = path.dirname(config.dest);
        await docker.execInContainer(containerName, ['mkdir', '-p', destDir], {
          user: 'workspace',
        });

        await docker.copyToContainer(containerName, tempFile, config.dest);
        await docker.execInContainer(containerName, ['chown', 'workspace:workspace', config.dest], {
          user: 'root',
        });
        await docker.execInContainer(containerName, ['chmod', permissions, config.dest], {
          user: 'workspace',
        });
      } finally {
        await fs.unlink(tempFile).catch(() => {});
      }
    },
  };
}

export interface MockFileCopierCall {
  method: 'ensureDir' | 'copyFile' | 'copyDirectory' | 'writeConfig';
  args: unknown[];
}

export interface MockFileCopier extends FileCopier {
  calls: MockFileCopierCall[];
}

export function createMockFileCopier(): MockFileCopier {
  const calls: MockFileCopierCall[] = [];

  return {
    calls,

    async ensureDir(containerName: string, dir: string): Promise<void> {
      calls.push({ method: 'ensureDir', args: [containerName, dir] });
    },

    async copyFile(containerName: string, file: SyncFile): Promise<void> {
      calls.push({ method: 'copyFile', args: [containerName, file] });
    },

    async copyDirectory(containerName: string, dir: SyncDirectory): Promise<void> {
      calls.push({ method: 'copyDirectory', args: [containerName, dir] });
    },

    async writeConfig(containerName: string, config: GeneratedConfig): Promise<void> {
      calls.push({ method: 'writeConfig', args: [containerName, config] });
    },
  };
}
