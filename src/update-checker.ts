import { homedir } from 'os';
import { join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';

const GITHUB_REPO = 'gricha/perry';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateCache {
  lastCheck: number;
  latestVersion: string | null;
}

async function getCacheDir(): Promise<string> {
  const dir = join(homedir(), '.config', 'perry');
  await mkdir(dir, { recursive: true });
  return dir;
}

async function readCache(): Promise<UpdateCache | null> {
  try {
    const cacheFile = join(await getCacheDir(), 'update-cache.json');
    const content = await readFile(cacheFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeCache(cache: UpdateCache): Promise<void> {
  try {
    const cacheFile = join(await getCacheDir(), 'update-cache.json');
    await writeFile(cacheFile, JSON.stringify(cache));
  } catch {
    // Ignore cache write errors
  }
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      signal: AbortSignal.timeout(3000),
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'perry-update-checker',
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { tag_name?: string };
    const tag = data.tag_name || null;
    return tag ? tag.replace(/^v/, '') : null;
  } catch {
    return null;
  }
}

function compareVersions(current: string, latest: string): number {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (l > c) return 1;
    if (l < c) return -1;
  }
  return 0;
}

export async function checkForUpdates(currentVersion: string): Promise<void> {
  try {
    const cache = await readCache();
    const now = Date.now();

    let latestVersion: string | null = null;

    if (cache && now - cache.lastCheck < CHECK_INTERVAL_MS) {
      latestVersion = cache.latestVersion;
    } else {
      latestVersion = await fetchLatestVersion();
      await writeCache({ lastCheck: now, latestVersion });
    }

    if (latestVersion && compareVersions(currentVersion, latestVersion) > 0) {
      console.log('');
      console.log(
        `\x1b[33mUpdate available: \x1b[90m${currentVersion}\x1b[0m → \x1b[32m${latestVersion}\x1b[0m  \x1b[33mRun: \x1b[36mperry update\x1b[0m`
      );
      console.log('');
    }
  } catch {
    // Silently ignore update check errors
  }
}
