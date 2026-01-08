import { watch, type FSWatcher } from 'fs';
import { access } from 'fs/promises';
import type { AgentConfig } from '../shared/types';
import { expandPath } from '../config/loader';
import { getCredentialFilePaths } from '../agents';

const STANDARD_CREDENTIAL_FILES = ['~/.gitconfig', ...getCredentialFilePaths()];

interface FileWatcherOptions {
  config: AgentConfig;
  syncCallback: () => Promise<void>;
  debounceMs?: number;
}

export class FileWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private config: AgentConfig;
  private syncCallback: () => Promise<void>;
  private debounceMs: number;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSync = false;

  constructor(options: FileWatcherOptions) {
    this.config = options.config;
    this.syncCallback = options.syncCallback;
    this.debounceMs = options.debounceMs ?? 500;
    this.setupWatchers();
  }

  updateConfig(config: AgentConfig): void {
    this.config = config;
    this.rebuildWatchers();
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    for (const [filePath, watcher] of this.watchers) {
      watcher.close();
      console.log(`[file-watcher] Stopped watching: ${filePath}`);
    }
    this.watchers.clear();
  }

  private collectWatchPaths(): string[] {
    const paths = new Set<string>();

    for (const sourcePath of Object.values(this.config.credentials.files)) {
      paths.add(expandPath(sourcePath));
    }

    for (const stdPath of STANDARD_CREDENTIAL_FILES) {
      paths.add(expandPath(stdPath));
    }

    if (this.config.ssh?.global?.copy) {
      for (const keyPath of this.config.ssh.global.copy) {
        paths.add(expandPath(keyPath));
      }
    }

    if (this.config.ssh?.workspaces) {
      for (const wsConfig of Object.values(this.config.ssh.workspaces)) {
        if (wsConfig.copy) {
          for (const keyPath of wsConfig.copy) {
            paths.add(expandPath(keyPath));
          }
        }
      }
    }

    return Array.from(paths);
  }

  private async setupWatchers(): Promise<void> {
    const paths = this.collectWatchPaths();

    for (const filePath of paths) {
      await this.watchFile(filePath);
    }
  }

  private async watchFile(filePath: string): Promise<void> {
    if (this.watchers.has(filePath)) {
      return;
    }

    try {
      await access(filePath);
    } catch {
      return;
    }

    try {
      const watcher = watch(filePath, (eventType) => {
        if (eventType === 'change' || eventType === 'rename') {
          this.handleFileChange(filePath);
        }
      });

      watcher.on('error', (err) => {
        console.error(`[file-watcher] Error watching ${filePath}:`, err);
        this.watchers.delete(filePath);
      });

      this.watchers.set(filePath, watcher);
      console.log(`[file-watcher] Watching: ${filePath}`);
    } catch (err) {
      console.error(`[file-watcher] Failed to watch ${filePath}:`, err);
    }
  }

  private handleFileChange(filePath: string): void {
    console.log(`[file-watcher] Change detected: ${filePath}`);
    this.scheduleSync();
  }

  private scheduleSync(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.pendingSync = true;
    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      if (this.pendingSync) {
        this.pendingSync = false;
        try {
          console.log('[file-watcher] Triggering sync...');
          await this.syncCallback();
          console.log('[file-watcher] Sync completed');
        } catch (err) {
          console.error('[file-watcher] Sync failed:', err);
        }
      }
    }, this.debounceMs);
  }

  private rebuildWatchers(): void {
    const newPaths = new Set(this.collectWatchPaths());
    const currentPaths = new Set(this.watchers.keys());

    for (const filePath of currentPaths) {
      if (!newPaths.has(filePath)) {
        const watcher = this.watchers.get(filePath);
        if (watcher) {
          watcher.close();
          this.watchers.delete(filePath);
          console.log(`[file-watcher] Stopped watching: ${filePath}`);
        }
      }
    }

    for (const filePath of newPaths) {
      if (!currentPaths.has(filePath)) {
        this.watchFile(filePath);
      }
    }
  }
}
