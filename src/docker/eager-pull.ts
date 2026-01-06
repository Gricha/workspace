import { imageExists, tryPullImage, getDockerVersion } from './index';
import { WORKSPACE_IMAGE_REGISTRY } from '../shared/constants';
import pkg from '../../package.json';

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
