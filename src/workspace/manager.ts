import { AddressInfo, createServer } from 'net';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { AgentConfig } from '../shared/types';
import type { Workspace, CreateWorkspaceOptions } from './types';
import { StateManager } from './state';
import { expandPath } from '../config/loader';
import * as docker from '../docker';
import { getContainerName } from '../docker';

const VOLUME_PREFIX = 'workspace-';
const WORKSPACE_IMAGE = 'workspace:latest';
const SSH_PORT_RANGE_START = 2200;
const SSH_PORT_RANGE_END = 2400;

async function findAvailablePort(start: number, end: number): Promise<number> {
  for (let port = start; port <= end; port++) {
    const available = await new Promise<boolean>((resolve) => {
      const server = createServer();
      server.listen(port, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        server.close(() => resolve(addr.port === port));
      });
      server.on('error', () => resolve(false));
    });
    if (available) {
      return port;
    }
  }
  throw new Error(`No available port in range ${start}-${end}`);
}

export class WorkspaceManager {
  private state: StateManager;
  private config: AgentConfig;
  private configDir: string;

  constructor(configDir: string, config: AgentConfig) {
    this.state = new StateManager(configDir);
    this.config = config;
    this.configDir = configDir;
  }

  updateConfig(config: AgentConfig): void {
    this.config = config;
  }

  private async copyCredentialFiles(containerName: string): Promise<void> {
    const files = this.config.credentials.files;
    if (!files || Object.keys(files).length === 0) {
      return;
    }

    for (const [destPath, sourcePath] of Object.entries(files)) {
      const expandedSource = expandPath(sourcePath);
      const expandedDest = destPath.startsWith('~/')
        ? `/home/workspace/${destPath.slice(2)}`
        : destPath;

      try {
        await fs.access(expandedSource);
      } catch {
        console.warn(`Credential file not found, skipping: ${expandedSource}`);
        continue;
      }

      const stat = await fs.stat(expandedSource);
      if (stat.isDirectory()) {
        const tempTar = path.join(os.tmpdir(), `ws-cred-${Date.now()}.tar`);
        try {
          const { execSync } = await import('child_process');
          execSync(`tar -cf "${tempTar}" -C "${expandedSource}" .`, { stdio: 'pipe' });
          await docker.execInContainer(containerName, ['mkdir', '-p', expandedDest], {
            user: 'workspace',
          });
          await docker.copyToContainer(containerName, tempTar, '/tmp/credential.tar');
          await docker.execInContainer(
            containerName,
            ['tar', '-xf', '/tmp/credential.tar', '-C', expandedDest],
            { user: 'workspace' }
          );
          await docker.execInContainer(containerName, ['rm', '/tmp/credential.tar'], {
            user: 'workspace',
          });
        } finally {
          try {
            await fs.unlink(tempTar);
          } catch (err) {
            console.warn(`[workspace] Failed to clean up temp file ${tempTar}:`, err);
          }
        }
      } else {
        const destDir = path.dirname(expandedDest);
        await docker.execInContainer(containerName, ['mkdir', '-p', destDir], {
          user: 'workspace',
        });

        await docker.copyToContainer(containerName, expandedSource, expandedDest);

        await docker.execInContainer(
          containerName,
          ['chown', 'workspace:workspace', expandedDest],
          {
            user: 'root',
          }
        );

        const isPrivateKey =
          expandedDest.includes('.ssh') &&
          !expandedDest.endsWith('.pub') &&
          !expandedDest.endsWith('config') &&
          !expandedDest.endsWith('known_hosts');
        const mode = isPrivateKey ? '600' : '644';
        await docker.execInContainer(containerName, ['chmod', mode, expandedDest], {
          user: 'workspace',
        });
      }
    }
  }

  private async copyClaudeCredentials(containerName: string): Promise<void> {
    const credentialsPath = this.config.agents?.claude_code?.credentials_path;
    if (!credentialsPath) {
      return;
    }

    const expandedSource = expandPath(credentialsPath);

    try {
      await fs.access(expandedSource);
    } catch {
      console.warn(`Claude credentials not found, skipping: ${expandedSource}`);
      return;
    }

    const stat = await fs.stat(expandedSource);
    const destPath = '/home/workspace/.claude';

    if (stat.isDirectory()) {
      const tempTar = path.join(os.tmpdir(), `ws-claude-${Date.now()}.tar`);
      try {
        const { execSync } = await import('child_process');
        execSync(`tar -cf "${tempTar}" -C "${expandedSource}" .`, { stdio: 'pipe' });
        await docker.execInContainer(containerName, ['mkdir', '-p', destPath], {
          user: 'workspace',
        });
        await docker.copyToContainer(containerName, tempTar, '/tmp/claude-creds.tar');
        await docker.execInContainer(
          containerName,
          ['tar', '-xf', '/tmp/claude-creds.tar', '-C', destPath],
          { user: 'workspace' }
        );
        await docker.execInContainer(containerName, ['rm', '/tmp/claude-creds.tar'], {
          user: 'workspace',
        });
        await docker.execInContainer(containerName, ['chmod', '-R', '600', destPath], {
          user: 'workspace',
        });
        await docker.execInContainer(containerName, ['chmod', '700', destPath], {
          user: 'workspace',
        });
      } finally {
        try {
          await fs.unlink(tempTar);
        } catch (err) {
          console.warn(`[workspace] Failed to clean up temp file ${tempTar}:`, err);
        }
      }
    } else {
      await docker.execInContainer(containerName, ['mkdir', '-p', destPath], {
        user: 'workspace',
      });
      await docker.copyToContainer(containerName, expandedSource, `${destPath}/.credentials.json`);
      await docker.execInContainer(
        containerName,
        ['chown', 'workspace:workspace', `${destPath}/.credentials.json`],
        { user: 'root' }
      );
      await docker.execInContainer(
        containerName,
        ['chmod', '600', `${destPath}/.credentials.json`],
        {
          user: 'workspace',
        }
      );
    }
  }

  private async runPostStartScript(containerName: string): Promise<void> {
    const scriptPath = this.config.scripts.post_start;
    if (!scriptPath) {
      return;
    }

    const expandedPath = expandPath(scriptPath);

    try {
      await fs.access(expandedPath);
    } catch {
      console.warn(`Post-start script not found, skipping: ${expandedPath}`);
      return;
    }

    const destPath = '/workspace/post-start.sh';
    await docker.copyToContainer(containerName, expandedPath, destPath);
    await docker.execInContainer(containerName, ['chown', 'workspace:workspace', destPath], {
      user: 'root',
    });
    await docker.execInContainer(containerName, ['chmod', '+x', destPath], {
      user: 'workspace',
    });

    await docker.execInContainer(containerName, ['bash', destPath], {
      user: 'workspace',
    });
  }

  private async syncWorkspaceStatus(workspace: Workspace): Promise<void> {
    const containerName = getContainerName(workspace.name);
    const running = await docker.containerRunning(containerName);
    const newStatus = running ? 'running' : 'stopped';
    if (
      workspace.status !== newStatus &&
      workspace.status !== 'creating' &&
      workspace.status !== 'error'
    ) {
      workspace.status = newStatus;
      await this.state.setWorkspace(workspace);
    }
  }

  async list(): Promise<Workspace[]> {
    const workspaces = await this.state.getAllWorkspaces();

    for (const ws of workspaces) {
      await this.syncWorkspaceStatus(ws);
    }

    return workspaces;
  }

  async get(name: string): Promise<Workspace | null> {
    const workspace = await this.state.getWorkspace(name);
    if (!workspace) {
      return null;
    }

    await this.syncWorkspaceStatus(workspace);

    return workspace;
  }

  async create(options: CreateWorkspaceOptions): Promise<Workspace> {
    const { name, clone, env } = options;
    const containerName = getContainerName(name);
    const volumeName = `${VOLUME_PREFIX}${name}`;

    const existing = await this.state.getWorkspace(name);
    if (existing) {
      throw new Error(`Workspace '${name}' already exists`);
    }

    const workspace: Workspace = {
      name,
      status: 'creating',
      containerId: '',
      created: new Date().toISOString(),
      repo: clone,
      ports: {
        ssh: 0,
      },
    };
    await this.state.setWorkspace(workspace);

    try {
      const imageReady = await docker.imageExists(WORKSPACE_IMAGE);
      if (!imageReady) {
        throw new Error(
          `Workspace image '${WORKSPACE_IMAGE}' not found. Run 'workspace build' first.`
        );
      }

      if (!(await docker.volumeExists(volumeName))) {
        await docker.createVolume(volumeName);
      }

      const sshPort = await findAvailablePort(SSH_PORT_RANGE_START, SSH_PORT_RANGE_END);

      const containerEnv: Record<string, string> = {
        ...this.config.credentials.env,
        ...env,
      };

      if (this.config.agents?.opencode?.api_key) {
        containerEnv.OPENAI_API_KEY = this.config.agents.opencode.api_key;
      }
      if (this.config.agents?.opencode?.api_base_url) {
        containerEnv.OPENAI_BASE_URL = this.config.agents.opencode.api_base_url;
      }
      if (this.config.agents?.github?.token) {
        containerEnv.GITHUB_TOKEN = this.config.agents.github.token;
      }
      if (this.config.agents?.claude_code?.oauth_token) {
        containerEnv.CLAUDE_CODE_OAUTH_TOKEN = this.config.agents.claude_code.oauth_token;
      }

      if (clone) {
        containerEnv.WORKSPACE_REPO_URL = clone;
      }

      const containerId = await docker.createContainer({
        name: containerName,
        image: WORKSPACE_IMAGE,
        hostname: name,
        privileged: true,
        restartPolicy: 'unless-stopped',
        env: containerEnv,
        volumes: [{ source: volumeName, target: '/home/workspace', readonly: false }],
        ports: [{ hostPort: sshPort, containerPort: 22, protocol: 'tcp' }],
        labels: {
          'workspace.name': name,
          'workspace.managed': 'true',
        },
      });

      workspace.containerId = containerId;
      workspace.ports.ssh = sshPort;
      await this.state.setWorkspace(workspace);

      await docker.startContainer(containerName);

      await this.copyCredentialFiles(containerName);
      await this.copyClaudeCredentials(containerName);

      workspace.status = 'running';
      await this.state.setWorkspace(workspace);

      await this.runPostStartScript(containerName);

      return workspace;
    } catch (err) {
      workspace.status = 'error';
      await this.state.setWorkspace(workspace);
      throw err;
    }
  }

  async start(name: string): Promise<Workspace> {
    const workspace = await this.state.getWorkspace(name);
    if (!workspace) {
      throw new Error(`Workspace '${name}' not found`);
    }

    const containerName = getContainerName(name);
    const exists = await docker.containerExists(containerName);
    if (!exists) {
      throw new Error(`Container for workspace '${name}' not found`);
    }

    const running = await docker.containerRunning(containerName);
    if (running) {
      return workspace;
    }

    await docker.startContainer(containerName);

    await this.copyCredentialFiles(containerName);
    await this.copyClaudeCredentials(containerName);

    workspace.status = 'running';
    await this.state.setWorkspace(workspace);

    await this.runPostStartScript(containerName);

    return workspace;
  }

  async stop(name: string): Promise<Workspace> {
    const workspace = await this.state.getWorkspace(name);
    if (!workspace) {
      throw new Error(`Workspace '${name}' not found`);
    }

    const containerName = getContainerName(name);
    const running = await docker.containerRunning(containerName);
    if (!running) {
      workspace.status = 'stopped';
      await this.state.setWorkspace(workspace);
      return workspace;
    }

    await docker.stopContainer(containerName);
    workspace.status = 'stopped';
    await this.state.setWorkspace(workspace);

    return workspace;
  }

  async delete(name: string): Promise<void> {
    const workspace = await this.state.getWorkspace(name);
    if (!workspace) {
      throw new Error(`Workspace '${name}' not found`);
    }

    const containerName = getContainerName(name);
    const volumeName = `${VOLUME_PREFIX}${name}`;

    if (await docker.containerExists(containerName)) {
      await docker.removeContainer(containerName, true);
    }

    if (await docker.volumeExists(volumeName)) {
      await docker.removeVolume(volumeName, true);
    }

    await this.state.deleteWorkspace(name);
  }

  async exec(name: string, command: string[]): Promise<docker.ExecResult> {
    const workspace = await this.state.getWorkspace(name);
    if (!workspace) {
      throw new Error(`Workspace '${name}' not found`);
    }

    const containerName = getContainerName(name);
    const running = await docker.containerRunning(containerName);
    if (!running) {
      throw new Error(`Workspace '${name}' is not running`);
    }

    return docker.execInContainer(containerName, command, { user: 'workspace' });
  }

  async getLogs(name: string, tail = 100): Promise<string> {
    const workspace = await this.state.getWorkspace(name);
    if (!workspace) {
      throw new Error(`Workspace '${name}' not found`);
    }

    const containerName = getContainerName(name);
    return docker.getLogs(containerName, { tail });
  }
}
