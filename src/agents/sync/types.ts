import type { SyncFile, SyncDirectory, GeneratedConfig } from '../types';

export interface FileCopier {
  ensureDir(containerName: string, dir: string): Promise<void>;
  copyFile(containerName: string, file: SyncFile): Promise<void>;
  copyDirectory(containerName: string, dir: SyncDirectory): Promise<void>;
  writeConfig(containerName: string, config: GeneratedConfig): Promise<void>;
}
