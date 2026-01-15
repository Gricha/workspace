import { readFile } from 'fs/promises';
import type { SSHSettings, SSHKeyConfig } from '../shared/types';
import { discoverSSHKeys, readPublicKey, getSSHDir } from './discovery';
import { expandPath } from '../shared/path-utils';
import { join } from 'path';

export interface SSHSyncResult {
  authorizedKeys: string[];
  copiedKeys: string[];
  errors: string[];
}

async function readHostAuthorizedKeys(): Promise<string[]> {
  try {
    const sshDir = await getSSHDir();
    const authKeysPath = join(sshDir, 'authorized_keys');
    const content = await readFile(authKeysPath, 'utf-8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  } catch {
    return [];
  }
}

export function getEffectiveSSHConfig(settings: SSHSettings, workspaceName?: string): SSHKeyConfig {
  const global = settings.global;

  if (!workspaceName) {
    return global;
  }

  const workspaceOverride = settings.workspaces[workspaceName];
  if (!workspaceOverride) {
    return global;
  }

  return {
    copy: workspaceOverride.copy ?? global.copy,
    authorize: workspaceOverride.authorize ?? global.authorize,
  };
}

export async function collectAuthorizedKeys(
  settings: SSHSettings,
  workspaceName?: string
): Promise<string[]> {
  const keys: string[] = [];
  const config = getEffectiveSSHConfig(settings, workspaceName);

  if (settings.autoAuthorizeHostKeys) {
    const hostKeys = await discoverSSHKeys();
    for (const key of hostKeys) {
      try {
        const pubContent = await readPublicKey(key.path);
        if (pubContent) {
          keys.push(pubContent.trim());
        }
      } catch {
        continue;
      }
    }

    const hostAuthorizedKeys = await readHostAuthorizedKeys();
    for (const key of hostAuthorizedKeys) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }

  for (const keyPath of config.authorize) {
    try {
      const expandedPath = expandPath(keyPath);
      const pubContent = await readPublicKey(expandedPath);
      if (pubContent && !keys.includes(pubContent.trim())) {
        keys.push(pubContent.trim());
      }
    } catch {
      continue;
    }
  }

  return keys;
}

export async function collectCopyKeys(
  settings: SSHSettings,
  workspaceName?: string
): Promise<Array<{ name: string; privateKey: string; publicKey: string }>> {
  const result: Array<{ name: string; privateKey: string; publicKey: string }> = [];
  const config = getEffectiveSSHConfig(settings, workspaceName);

  for (const keyPath of config.copy) {
    try {
      const expandedPath = expandPath(keyPath);
      const baseName = expandedPath.split('/').pop()?.replace('.pub', '') || 'key';
      const privatePath = expandedPath.endsWith('.pub')
        ? expandedPath.replace('.pub', '')
        : expandedPath;
      const publicPath = `${privatePath}.pub`;

      const privateKey = await readFile(privatePath, 'utf-8');
      const publicKey = await readFile(publicPath, 'utf-8');

      result.push({
        name: baseName,
        privateKey: privateKey.trim(),
        publicKey: publicKey.trim(),
      });
    } catch {
      continue;
    }
  }

  return result;
}
