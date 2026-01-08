import { spawn } from 'child_process';
import type {
  CommandResult,
  CommandError,
  ContainerInfo,
  ContainerCreateOptions,
  VolumeInfo,
  NetworkInfo,
  ExecOptions,
  ExecResult,
  PortMapping,
} from './types';
import { CONTAINER_PREFIX } from '../shared/constants';

export * from './types';

export function getContainerName(name: string): string {
  return `${CONTAINER_PREFIX}${name}`;
}

async function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      const result = { stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 1 };
      if (code === 0) {
        resolve(result);
      } else {
        const err = new Error(`Command failed: ${command} ${args.join(' ')}`) as CommandError;
        err.code = code ?? undefined;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      }
    });
  });
}

async function docker(args: string[]): Promise<CommandResult> {
  return runCommand('docker', args);
}

export async function getDockerVersion(): Promise<string> {
  const { stdout } = await docker(['version', '--format', '{{.Server.Version}}']);
  return stdout;
}

export async function containerExists(name: string): Promise<boolean> {
  const { stdout } = await docker(['ps', '-a', '-q', '--filter', `name=^${name}$`]);
  return stdout.length > 0;
}

export async function containerRunning(name: string): Promise<boolean> {
  const { stdout } = await docker([
    'ps',
    '-q',
    '--filter',
    `name=^${name}$`,
    '--filter',
    'status=running',
  ]);
  return stdout.length > 0;
}

export async function getContainer(name: string): Promise<ContainerInfo | null> {
  try {
    const { stdout } = await docker(['inspect', '--format', '{{json .}}', name]);
    const data = JSON.parse(stdout);

    const portMappings: PortMapping[] = [];
    const networkSettings = data.NetworkSettings?.Ports || {};
    for (const [containerPort, hostBindings] of Object.entries(networkSettings)) {
      if (!hostBindings) continue;
      const [port, protocol] = containerPort.split('/');
      for (const binding of hostBindings as Array<{ HostPort: string }>) {
        portMappings.push({
          containerPort: parseInt(port, 10),
          hostPort: parseInt(binding.HostPort, 10),
          protocol: protocol as 'tcp' | 'udp',
        });
      }
    }

    return {
      id: data.Id,
      name: data.Name.replace(/^\//, ''),
      image: data.Config.Image,
      status: data.State.Status,
      state: data.State.Running ? 'running' : data.State.Status,
      ports: portMappings,
    };
  } catch (err) {
    const stderr = (err as CommandError).stderr?.toLowerCase() || '';
    if (!stderr.includes('no such object') && !stderr.includes('no such container')) {
      console.error(`[docker] Error getting container '${name}':`, stderr);
    }
    return null;
  }
}

export async function getContainerIp(name: string): Promise<string | null> {
  try {
    const { stdout } = await docker([
      'inspect',
      '--format',
      '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
      name,
    ]);
    const ip = stdout.trim();
    return ip || null;
  } catch {
    return null;
  }
}

export async function listContainers(prefix?: string): Promise<ContainerInfo[]> {
  const args = ['ps', '-a', '--format', '{{json .}}'];
  if (prefix) {
    args.push('--filter', `name=^${prefix}`);
  }

  const { stdout } = await docker(args);
  if (!stdout) return [];

  const containers: ContainerInfo[] = [];
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const data = JSON.parse(line);
    containers.push({
      id: data.ID,
      name: data.Names,
      image: data.Image,
      status: data.Status,
      state: data.State.toLowerCase() as ContainerInfo['state'],
      ports: [],
    });
  }
  return containers;
}

export async function createContainer(options: ContainerCreateOptions): Promise<string> {
  const args: string[] = ['create'];

  if (options.name) {
    args.push('--name', options.name);
  }
  if (options.hostname) {
    args.push('--hostname', options.hostname);
  }
  if (options.privileged) {
    args.push('--privileged');
  }
  if (options.network) {
    args.push('--network', options.network);
  }
  if (options.workdir) {
    args.push('--workdir', options.workdir);
  }
  if (options.user) {
    args.push('--user', options.user);
  }
  if (options.restartPolicy) {
    args.push('--restart', options.restartPolicy);
  }

  if (options.env) {
    for (const [key, value] of Object.entries(options.env)) {
      args.push('-e', `${key}=${value}`);
    }
  }

  if (options.volumes) {
    for (const vol of options.volumes) {
      const mode = vol.readonly ? 'ro' : 'rw';
      args.push('-v', `${vol.source}:${vol.target}:${mode}`);
    }
  }

  if (options.ports) {
    for (const port of options.ports) {
      args.push('-p', `${port.hostPort}:${port.containerPort}/${port.protocol}`);
    }
  }

  if (options.labels) {
    for (const [key, value] of Object.entries(options.labels)) {
      args.push('--label', `${key}=${value}`);
    }
  }

  if (options.entrypoint) {
    args.push('--entrypoint', options.entrypoint.join(' '));
  }

  args.push(options.image);

  if (options.command) {
    args.push(...options.command);
  }

  const { stdout } = await docker(args);
  return stdout.trim();
}

export async function startContainer(name: string): Promise<void> {
  await docker(['start', name]);
}

export async function waitForContainerReady(
  name: string,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const timeout = options.timeout ?? 30000;
  const interval = options.interval ?? 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await execInContainer(name, ['true']);
      if (result.exitCode === 0) {
        return;
      }
    } catch {
      // Container not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Container '${name}' did not become ready within ${timeout}ms`);
}

export async function stopContainer(name: string, timeout = 10): Promise<void> {
  await docker(['stop', '-t', String(timeout), name]);
}

export async function removeContainer(name: string, force = false): Promise<void> {
  const args = ['rm'];
  if (force) args.push('-f');
  args.push(name);
  await docker(args);
}

export async function execInContainer(
  name: string,
  command: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const args: string[] = ['exec'];

  if (options.user) {
    args.push('-u', options.user);
  }
  if (options.workdir) {
    args.push('-w', options.workdir);
  }
  if (options.env) {
    for (const [key, value] of Object.entries(options.env)) {
      args.push('-e', `${key}=${value}`);
    }
  }

  args.push(name, ...command);

  try {
    const result = await docker(args);
    return { ...result, exitCode: 0 };
  } catch (err) {
    const cmdErr = err as CommandError;
    return {
      stdout: cmdErr.stdout || '',
      stderr: cmdErr.stderr || '',
      code: cmdErr.code || 1,
      exitCode: cmdErr.code || 1,
    };
  }
}

export async function copyToContainer(
  containerName: string,
  sourcePath: string,
  destPath: string
): Promise<void> {
  await docker(['cp', sourcePath, `${containerName}:${destPath}`]);
}

export async function copyFromContainer(
  containerName: string,
  sourcePath: string,
  destPath: string
): Promise<void> {
  await docker(['cp', `${containerName}:${sourcePath}`, destPath]);
}

export async function volumeExists(name: string): Promise<boolean> {
  try {
    await docker(['volume', 'inspect', name]);
    return true;
  } catch (err) {
    const stderr = (err as CommandError).stderr?.toLowerCase() || '';
    if (!stderr.includes('no such volume')) {
      console.error(`[docker] Error checking volume '${name}':`, stderr);
    }
    return false;
  }
}

export async function createVolume(name: string): Promise<void> {
  await docker(['volume', 'create', name]);
}

export async function removeVolume(name: string, force = false): Promise<void> {
  const args = ['volume', 'rm'];
  if (force) args.push('-f');
  args.push(name);
  await docker(args);
}

export async function getVolume(name: string): Promise<VolumeInfo | null> {
  try {
    const { stdout } = await docker(['volume', 'inspect', '--format', '{{json .}}', name]);
    const data = JSON.parse(stdout);
    return {
      name: data.Name,
      driver: data.Driver,
      mountpoint: data.Mountpoint,
    };
  } catch (err) {
    const stderr = (err as CommandError).stderr?.toLowerCase() || '';
    if (!stderr.includes('no such volume')) {
      console.error(`[docker] Error getting volume '${name}':`, stderr);
    }
    return null;
  }
}

export async function networkExists(name: string): Promise<boolean> {
  try {
    await docker(['network', 'inspect', name]);
    return true;
  } catch (err) {
    const stderr = (err as CommandError).stderr?.toLowerCase() || '';
    if (!stderr.includes('no such network')) {
      console.error(`[docker] Error checking network '${name}':`, stderr);
    }
    return false;
  }
}

export async function createNetwork(name: string): Promise<void> {
  await docker(['network', 'create', name]);
}

export async function removeNetwork(name: string): Promise<void> {
  await docker(['network', 'rm', name]);
}

export async function getNetwork(name: string): Promise<NetworkInfo | null> {
  try {
    const { stdout } = await docker(['network', 'inspect', '--format', '{{json .}}', name]);
    const data = JSON.parse(stdout);
    return {
      name: data.Name,
      id: data.Id,
      driver: data.Driver,
    };
  } catch (err) {
    const stderr = (err as CommandError).stderr?.toLowerCase() || '';
    if (!stderr.includes('no such network')) {
      console.error(`[docker] Error getting network '${name}':`, stderr);
    }
    return null;
  }
}

export async function connectToNetwork(containerName: string, networkName: string): Promise<void> {
  try {
    await docker(['network', 'connect', networkName, containerName]);
  } catch (err) {
    const message = (err as CommandError).stderr || '';
    if (!message.includes('already exists in network')) {
      throw err;
    }
  }
}

export async function imageExists(tag: string): Promise<boolean> {
  try {
    await docker(['image', 'inspect', tag]);
    return true;
  } catch (err) {
    const stderr = (err as CommandError).stderr?.toLowerCase() || '';
    if (!stderr.includes('no such image')) {
      console.error(`[docker] Error checking image '${tag}':`, stderr);
    }
    return false;
  }
}

export async function pullImage(tag: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['pull', tag], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to pull image ${tag}`));
      }
    });
  });
}

export async function tryPullImage(tag: string): Promise<boolean> {
  try {
    await pullImage(tag);
    return true;
  } catch {
    return false;
  }
}

export async function buildImage(
  tag: string,
  context: string,
  options: { noCache?: boolean } = {}
): Promise<void> {
  const args = ['build', '-t', tag];
  if (options.noCache) {
    args.push('--no-cache');
  }
  args.push(context);

  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Docker build failed with exit code ${code}`));
      }
    });
  });
}

export async function getLogs(
  containerName: string,
  options: { tail?: number; since?: string } = {}
): Promise<string> {
  const args = ['logs'];
  if (options.tail) {
    args.push('--tail', String(options.tail));
  }
  if (options.since) {
    args.push('--since', options.since);
  }
  args.push(containerName);

  const { stdout, stderr } = await docker(args);
  return stdout + stderr;
}

export async function cloneVolume(sourceVolume: string, destVolume: string): Promise<void> {
  if (!(await volumeExists(sourceVolume))) {
    throw new Error(`Source volume '${sourceVolume}' does not exist`);
  }

  if (await volumeExists(destVolume)) {
    throw new Error(`Volume '${destVolume}' already exists`);
  }

  await createVolume(destVolume);

  try {
    await docker([
      'run',
      '--rm',
      '-v',
      `${sourceVolume}:/source:ro`,
      '-v',
      `${destVolume}:/dest`,
      'alpine',
      'sh',
      '-c',
      'cp -a /source/. /dest/',
    ]);
  } catch (err) {
    await removeVolume(destVolume, true).catch(() => {});
    throw new Error(`Failed to clone volume: ${(err as Error).message}`);
  }
}
