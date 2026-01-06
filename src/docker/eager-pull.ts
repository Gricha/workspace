import { imageExists, tryPullImage, getDockerVersion } from './index';
import { WORKSPACE_IMAGE_LOCAL, WORKSPACE_IMAGE_REGISTRY } from '../shared/constants';

const RETRY_INTERVAL_MS = 20000;
const MAX_RETRIES = 10;

let pullInProgress = false;
let pullComplete = false;

async function isDockerAvailable(): Promise<boolean> {
  try {
    await getDockerVersion();
    return true;
  } catch {
    return false;
  }
}

async function pullWorkspaceImage(): Promise<boolean> {
  const localExists = await imageExists(WORKSPACE_IMAGE_LOCAL);
  if (localExists) {
    console.log('[agent] Workspace image already available locally');
    return true;
  }

  console.log(`[agent] Pulling workspace image from ${WORKSPACE_IMAGE_REGISTRY}...`);
  const pulled = await tryPullImage(WORKSPACE_IMAGE_REGISTRY);

  if (pulled) {
    console.log('[agent] Workspace image pulled successfully');
    return true;
  }

  console.log('[agent] Failed to pull image - will retry later or build on first workspace create');
  return false;
}

export async function startEagerImagePull(): Promise<void> {
  if (pullInProgress || pullComplete) {
    return;
  }

  pullInProgress = true;

  const attemptPull = async (attempt: number): Promise<void> => {
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
      setTimeout(() => attemptPull(attempt + 1), RETRY_INTERVAL_MS);
      return;
    }

    const success = await pullWorkspaceImage();

    if (success) {
      pullComplete = true;
      pullInProgress = false;
    } else {
      setTimeout(() => attemptPull(attempt + 1), RETRY_INTERVAL_MS);
    }
  };

  attemptPull(1);
}

export function isImagePullComplete(): boolean {
  return pullComplete;
}
