import { imageExists, tryPullImage, getDockerVersion } from './index';
import { WORKSPACE_IMAGE_REGISTRY } from '../shared/constants';
import pkg from '../../package.json';

const RETRY_INTERVAL_MS = 20000;
const MAX_RETRIES = 10;

let pullInProgress = false;
let pullComplete = false;
let abortController: AbortController | null = null;

async function isDockerAvailable(): Promise<boolean> {
  try {
    await getDockerVersion();
    return true;
  } catch {
    return false;
  }
}

async function pullWorkspaceImage(): Promise<boolean> {
  const registryImage = `${WORKSPACE_IMAGE_REGISTRY}:${pkg.version}`;

  const exists = await imageExists(registryImage);
  if (exists) {
    console.log(`[agent] Workspace image ${registryImage} already available`);
    return true;
  }

  console.log(`[agent] Pulling workspace image ${registryImage}...`);
  const pulled = await tryPullImage(registryImage);

  if (pulled) {
    console.log('[agent] Workspace image pulled successfully');
    return true;
  }

  console.log('[agent] Failed to pull image - will retry later');
  return false;
}

export async function startEagerImagePull(): Promise<void> {
  if (pullInProgress || pullComplete) {
    return;
  }

  pullInProgress = true;
  abortController = new AbortController();
  const signal = abortController.signal;

  const attemptPull = async (attempt: number): Promise<void> => {
    if (signal.aborted) {
      pullInProgress = false;
      return;
    }

    if (attempt > MAX_RETRIES) {
      console.log('[agent] Max retries reached for image pull - giving up background pull');
      pullInProgress = false;
      return;
    }

    const dockerAvailable = await isDockerAvailable();

    if (!dockerAvailable) {
      if (attempt === 1) {
        console.log('[agent] Docker not available - will retry in background');
      }
      const timer = setTimeout(() => attemptPull(attempt + 1), RETRY_INTERVAL_MS);
      timer.unref();
      return;
    }

    const success = await pullWorkspaceImage();

    if (success) {
      pullComplete = true;
      pullInProgress = false;
    } else if (!signal.aborted) {
      const timer = setTimeout(() => attemptPull(attempt + 1), RETRY_INTERVAL_MS);
      timer.unref();
    }
  };

  attemptPull(1);
}

export function stopEagerImagePull(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  pullInProgress = false;
}

export function isImagePullComplete(): boolean {
  return pullComplete;
}
