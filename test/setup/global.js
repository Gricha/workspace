import { spawn, execSync } from 'child_process';
import path from 'path';

async function cleanupOrphanedResources() {
  console.log('\n🧹 Cleaning up orphaned test resources...\n');

  try {
    const containers = execSync(
      'docker ps -aq --filter "name=workspace-perrytest-" 2>/dev/null || true',
      { encoding: 'utf-8' }
    ).trim();

    if (containers) {
      execSync(`docker rm -f ${containers.split('\n').join(' ')} 2>/dev/null || true`);
      console.log('   Removed orphaned containers');
    }

    const volumes = execSync(
      'docker volume ls -q --filter "name=workspace-perrytest-" 2>/dev/null || true',
      { encoding: 'utf-8' }
    ).trim();

    if (volumes) {
      execSync(`docker volume rm -f ${volumes.split('\n').join(' ')} 2>/dev/null || true`);
      console.log('   Removed orphaned volumes');
    }
  } catch {}
}

function imageExists() {
  try {
    execSync('docker image inspect perry:latest', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function buildImage() {
  if (process.env.SKIP_DOCKER_BUILD === 'true' && imageExists()) {
    console.log('\n✅ Using existing perry:latest image (SKIP_DOCKER_BUILD=true)\n');
    return;
  }

  if (imageExists() && !process.env.FORCE_DOCKER_BUILD) {
    console.log('\n✅ Using existing perry:latest image\n');
    return;
  }

  return new Promise((resolve, reject) => {
    console.log('\n🏗️  Building workspace Docker image once for all tests...\n');

    const buildContext = path.join(process.cwd(), 'perry');
    const proc = spawn('docker', ['build', '-t', 'perry:latest', buildContext], {
      stdio: 'inherit',
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Workspace Docker image built successfully\n');
        resolve();
      } else {
        reject(new Error(`Docker build failed with exit code ${code}`));
      }
    });
  });
}

export async function setup() {
  await cleanupOrphanedResources();
  await buildImage();
}

export async function teardown() {
  console.log('\n🧹 Test suite completed\n');
}
