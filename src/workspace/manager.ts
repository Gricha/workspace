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
import {
  VOLUME_PREFIX,
  WORKSPACE_IMAGE,
  SSH_PORT_RANGE_START,
  SSH_PORT_RANGE_END,
} from '../shared/constants';

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

interface CopyCredentialOptions {
  source: string;
  dest: string;
  containerName: string;
  dirPermissions?: string;
  filePermissions?: string;
  tempPrefix?: string;
}

async function copyCredentialToContainer(options: CopyCredentialOptions): Promise<void> {
  const {
    source,
    dest,
    containerName,
    dirPermissions = '700',
    filePermissions = '600',
    tempPrefix = 'ws-cred',
  } = options;

  const expandedSource = expandPath(source);

  try {
    await fs.access(expandedSource);
  } catch {
    return;
  }

  const stat = await fs.stat(expandedSource);

  if (stat.isDirectory()) {
    const tempTar = path.join(os.tmpdir(), `${tempPrefix}-${Date.now()}.tar`);
    try {
      const { execSync } = await import('child_process');
      execSync(`tar -cf "${tempTar}" -C "${expandedSource}" .`, { stdio: 'pipe' });
      await docker.execInContainer(containerName, ['mkdir', '-p', dest], {
        user: 'workspace',
      });
      await docker.copyToContainer(containerName, tempTar, '/tmp/creds.tar');
      await docker.execInContainer(containerName, ['tar', '-xf', '/tmp/creds.tar', '-C', dest], {
        user: 'workspace',
      });
      await docker.execInContainer(containerName, ['rm', '/tmp/creds.tar'], {
        user: 'workspace',
      });
      await docker.execInContainer(containerName, ['chmod', '-R', filePermissions, dest], {
        user: 'workspace',
      });
      await docker.execInContainer(containerName, ['chmod', dirPermissions, dest], {
        user: 'workspace',
      });
    } finally {
      await fs.unlink(tempTar).catch((err) => {
        console.warn(`[workspace] Failed to clean up temp file ${tempTar}:`, err);
      });
    }
  } else {
    const destDir = path.dirname(dest);
    await docker.execInContainer(containerName, ['mkdir', '-p', destDir], {
      user: 'workspace',
    });
    await docker.copyToContainer(containerName, expandedSource, dest);
    await docker.execInContainer(containerName, ['chown', 'workspace:workspace', dest], {
      user: 'root',
    });
    await docker.execInContainer(containerName, ['chmod', filePermissions, dest], {
      user: 'workspace',
    });
  }
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
      const expandedDest = destPath.startsWith('~/')
        ? `/home/workspace/${destPath.slice(2)}`
        : destPath;

      const isPrivateKey =
        expandedDest.includes('.ssh') &&
        !expandedDest.endsWith('.pub') &&
        !expandedDest.endsWith('config') &&
        !expandedDest.endsWith('known_hosts');
      const filePermissions = isPrivateKey ? '600' : '644';

      await copyCredentialToContainer({
        source: sourcePath,
        dest: expandedDest,
        containerName,
        filePermissions,
        tempPrefix: 'ws-cred',
      });
    }
  }

  private async setupClaudeCodeConfig(containerName: string): Promise<void> {
    const localClaudeCredentials = expandPath('~/.claude/.credentials.json');

    const configContent = JSON.stringify({ hasCompletedOnboarding: true });
    const tempFile = path.join(os.tmpdir(), `ws-claude-config-${Date.now()}.json`);
    try {
      await fs.writeFile(tempFile, configContent);
      await docker.copyToContainer(containerName, tempFile, '/home/workspace/.claude.json');
      await docker.execInContainer(
        containerName,
        ['chown', 'workspace:workspace', '/home/workspace/.claude.json'],
        { user: 'root' }
      );
      await docker.execInContainer(
        containerName,
        ['chmod', '644', '/home/workspace/.claude.json'],
        { user: 'workspace' }
      );
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }

    try {
      await fs.access(localClaudeCredentials);
      await docker.execInContainer(containerName, ['mkdir', '-p', '/home/workspace/.claude'], {
        user: 'workspace',
      });
      await copyCredentialToContainer({
        source: '~/.claude/.credentials.json',
        dest: '/home/workspace/.claude/.credentials.json',
        containerName,
        filePermissions: '600',
        tempPrefix: 'ws-claude-creds',
      });
    } catch {
      // No credentials file - that's OK, user may use oauth_token env var instead
    }
  }

  private async copyCodexCredentials(containerName: string): Promise<void> {
    const codexDir = expandPath('~/.codex');
    try {
      await fs.access(codexDir);
    } catch {
      return;
    }

    await docker.execInContainer(containerName, ['mkdir', '-p', '/home/workspace/.codex'], {
      user: 'workspace',
    });

    await copyCredentialToContainer({
      source: '~/.codex/auth.json',
      dest: '/home/workspace/.codex/auth.json',
      containerName,
      filePermissions: '600',
      tempPrefix: 'ws-codex-auth',
    });

    await copyCredentialToContainer({
      source: '~/.codex/config.toml',
      dest: '/home/workspace/.codex/config.toml',
      containerName,
      filePermissions: '600',
      tempPrefix: 'ws-codex-config',
    });
  }

  private async setupOpencodeConfig(containerName: string): Promise<void> {
    const zenToken = this.config.agents?.opencode?.zen_token;
    if (!zenToken) {
      return;
    }

    const config = {
      provider: {
        opencode: {
          options: {
            apiKey: zenToken,
          },
        },
      },
      model: 'opencode/claude-sonnet-4',
    };

    const configJson = JSON.stringify(config, null, 2);
    const tempFile = `/tmp/ws-opencode-config-${Date.now()}.json`;

    await fs.writeFile(tempFile, configJson, 'utf-8');

    try {
      await docker.execInContainer(
        containerName,
        ['mkdir', '-p', '/home/workspace/.config/opencode'],
        {
          user: 'workspace',
        }
      );

      await docker.copyToContainer(
        containerName,
        tempFile,
        '/home/workspace/.config/opencode/opencode.json'
      );

      await docker.execInContainer(
        containerName,
        ['chown', 'workspace:workspace', '/home/workspace/.config/opencode/opencode.json'],
        { user: 'root' }
      );

      await docker.execInContainer(
        containerName,
        ['chmod', '600', '/home/workspace/.config/opencode/opencode.json'],
        { user: 'workspace' }
      );
    } finally {
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async copyGitConfig(containerName: string): Promise<void> {
    await copyCredentialToContainer({
      source: '~/.gitconfig',
      dest: '/home/workspace/.gitconfig',
      containerName,
      filePermissions: '644',
      tempPrefix: 'ws-gitconfig',
    });
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

    const exists = await docker.containerExists(containerName);
    if (!exists) {
      if (workspace.status !== 'error') {
        workspace.status = 'error';
        await this.state.setWorkspace(workspace);
      }
      return;
    }

    const running = await docker.containerRunning(containerName);
    const newStatus = running ? 'running' : 'stopped';
    if (workspace.status !== newStatus && workspace.status !== 'creating') {
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

      await this.copyGitConfig(containerName);
      await this.copyCredentialFiles(containerName);
      await this.setupClaudeCodeConfig(containerName);
      await this.copyCodexCredentials(containerName);
      await this.setupOpencodeConfig(containerName);

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
    const volumeName = `${VOLUME_PREFIX}${name}`;
    const exists = await docker.containerExists(containerName);

    if (!exists) {
      const volumeExists = await docker.volumeExists(volumeName);
      if (!volumeExists) {
        throw new Error(
          `Container and volume for workspace '${name}' were deleted. ` +
            `Please delete this workspace and create a new one.`
        );
      }

      const sshPort = await findAvailablePort(SSH_PORT_RANGE_START, SSH_PORT_RANGE_END);

      const containerEnv: Record<string, string> = {
        ...this.config.credentials.env,
      };

      if (this.config.agents?.github?.token) {
        containerEnv.GITHUB_TOKEN = this.config.agents.github.token;
      }
      if (this.config.agents?.claude_code?.oauth_token) {
        containerEnv.CLAUDE_CODE_OAUTH_TOKEN = this.config.agents.claude_code.oauth_token;
      }

      if (workspace.repo) {
        containerEnv.WORKSPACE_REPO_URL = workspace.repo;
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
    }

    const running = await docker.containerRunning(containerName);
    if (running) {
      workspace.status = 'running';
      await this.state.setWorkspace(workspace);
      return workspace;
    }

    await docker.startContainer(containerName);

    await this.copyGitConfig(containerName);
    await this.copyCredentialFiles(containerName);
    await this.setupClaudeCodeConfig(containerName);
    await this.copyCodexCredentials(containerName);
    await this.setupOpencodeConfig(containerName);

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

  async sync(name: string): Promise<void> {
    const workspace = await this.state.getWorkspace(name);
    if (!workspace) {
      throw new Error(`Workspace '${name}' not found`);
    }

    const containerName = getContainerName(name);
    const running = await docker.containerRunning(containerName);
    if (!running) {
      throw new Error(`Workspace '${name}' is not running`);
    }

    await this.copyGitConfig(containerName);
    await this.copyCredentialFiles(containerName);
    await this.setupClaudeCodeConfig(containerName);
    await this.copyCodexCredentials(containerName);
    await this.setupOpencodeConfig(containerName);
  }
}
