import { promises as fs } from 'fs';
import path from 'path';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

interface ModelCacheEntry {
  models: ModelInfo[];
  cachedAt: number;
}

interface ModelCache {
  claudeCode?: ModelCacheEntry;
  opencode?: ModelCacheEntry;
}

const CACHE_FILE = 'model-cache.json';
const TTL_MS = 60 * 60 * 1000;

export class ModelCacheManager {
  private cachePath: string;
  private cache: ModelCache | null = null;

  constructor(configDir: string) {
    this.cachePath = path.join(configDir, CACHE_FILE);
  }

  private async load(): Promise<ModelCache> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const content = await fs.readFile(this.cachePath, 'utf-8');
      this.cache = JSON.parse(content);
      return this.cache!;
    } catch {
      this.cache = {};
      return this.cache;
    }
  }

  private async save(): Promise<void> {
    if (!this.cache) return;
    await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
    await fs.writeFile(this.cachePath, JSON.stringify(this.cache, null, 2), 'utf-8');
  }

  private isExpired(entry: ModelCacheEntry | undefined): boolean {
    if (!entry) return true;
    return Date.now() - entry.cachedAt > TTL_MS;
  }

  async getClaudeCodeModels(): Promise<ModelInfo[] | null> {
    const cache = await this.load();
    if (this.isExpired(cache.claudeCode)) {
      return null;
    }
    return cache.claudeCode!.models;
  }

  async setClaudeCodeModels(models: ModelInfo[]): Promise<void> {
    const cache = await this.load();
    cache.claudeCode = {
      models,
      cachedAt: Date.now(),
    };
    await this.save();
  }

  async getOpencodeModels(): Promise<ModelInfo[] | null> {
    const cache = await this.load();
    if (this.isExpired(cache.opencode)) {
      return null;
    }
    return cache.opencode!.models;
  }

  async setOpencodeModels(models: ModelInfo[]): Promise<void> {
    const cache = await this.load();
    cache.opencode = {
      models,
      cachedAt: Date.now(),
    };
    await this.save();
  }

  async clearCache(): Promise<void> {
    this.cache = {};
    await this.save();
  }
}
