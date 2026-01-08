import type { AgentType } from '../sessions/types';
import type { AgentSessionProvider } from '../sessions/agents';
import type { AgentConfig } from '../shared/types';

export type SyncCategory = 'credential' | 'preference';

export interface SyncFile {
  source: string;
  dest: string;
  optional?: boolean;
  permissions?: string;
  category: SyncCategory;
}

export interface SyncDirectory {
  source: string;
  dest: string;
  optional?: boolean;
  category: SyncCategory;
}

export interface GeneratedConfig {
  dest: string;
  content: string;
  permissions?: string;
  category: SyncCategory;
}

export interface SyncContext {
  containerName: string;
  agentConfig: AgentConfig;
  hostFileExists: (path: string) => Promise<boolean>;
  hostDirExists: (path: string) => Promise<boolean>;
  readHostFile: (path: string) => Promise<string | null>;
  readContainerFile: (path: string) => Promise<string | null>;
}

export interface SyncResult {
  copied: string[];
  generated: string[];
  skipped: string[];
  errors: Array<{ path: string; error: string }>;
}

export interface AgentSyncProvider {
  getRequiredDirs(): string[];
  getFilesToSync(context: SyncContext): Promise<SyncFile[]>;
  getDirectoriesToSync(context: SyncContext): Promise<SyncDirectory[]>;
  getGeneratedConfigs(context: SyncContext): Promise<GeneratedConfig[]>;
}

export interface Agent {
  readonly agentType: AgentType;
  readonly sync: AgentSyncProvider;
  readonly sessions: AgentSessionProvider;
}
