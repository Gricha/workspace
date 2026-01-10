#!/usr/bin/env bun

import { Command } from 'commander';
import pkg from '../package.json';
import { startAgent } from './agent/run';
import { installService, uninstallService, showStatus } from './agent/systemd';
import { createApiClient, ApiClientError } from './client/api';
import { loadClientConfig, getWorker, setWorker } from './client/config';
import { openWSShell, openDockerExec, getTerminalWSUrl, isLocalWorker } from './client/ws-shell';
import { getContainerName, getContainerIp } from './docker';
import { startProxy, parsePortForward, formatPortForwards } from './client/proxy';
import {
  startDockerProxy,
  parsePortForward as parseDockerPortForward,
  formatPortForwards as formatDockerPortForwards,
} from './client/docker-proxy';
import { loadAgentConfig, saveAgentConfig, getConfigDir, ensureConfigDir } from './config/loader';
import { buildImage } from './docker';
import { DEFAULT_AGENT_PORT, WORKSPACE_IMAGE_LOCAL } from './shared/constants';
import { checkForUpdates } from './update-checker';
import { discoverSSHKeys } from './ssh';
import { formatUptime } from './shared/format-utils';

const program = new Command();

program
  .name('perry')
  .description('Distributed development environment orchestrator')
  .version(pkg.version)
  .action(() => {
    program.outputHelp();
  });

const agentCmd = program.command('agent').description('Manage the workspace agent daemon');

agentCmd
  .command('run')
  .description('Start the agent daemon')
  .option('-p, --port <port>', 'Port to listen on', parseInt)
  .option('-c, --config-dir <dir>', 'Configuration directory')
  .option('--no-host-access', 'Disable direct host machine access')
  .action(async (options) => {
    await startAgent({
      port: options.port,
      configDir: options.configDir,
      noHostAccess: options.hostAccess === false,
    });
  });

agentCmd
  .command('install')
  .description('Install agent as systemd user service')
  .option('-p, --port <port>', 'Port to listen on', parseInt)
  .option('-c, --config-dir <dir>', 'Configuration directory')
  .option('--no-host-access', 'Disable direct host machine access')
  .action(async (options) => {
    await installService({
      port: options.port,
      configDir: options.configDir,
      noHostAccess: options.hostAccess === false,
    });
  });

agentCmd
  .command('uninstall')
  .description('Uninstall agent systemd service')
  .action(async () => {
    await uninstallService();
  });

agentCmd
  .command('status')
  .description('Show agent service status')
  .action(async () => {
    await showStatus();
  });

agentCmd
  .command('logs')
  .description('View agent service logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <lines>', 'Number of lines to show', '50')
  .action(async (options) => {
    const { showLogs } = await import('./agent/systemd');
    await showLogs({
      follow: options.follow,
      lines: parseInt(options.lines, 10),
    });
  });

async function checkLocalAgent(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${DEFAULT_AGENT_PORT}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function getClient() {
  const worker = await getWorkerWithFallback();
  return createApiClient(worker);
}

async function getWorkerWithFallback(): Promise<string> {
  let worker = await getWorker();
  if (!worker) {
    const localRunning = await checkLocalAgent();
    if (localRunning) {
      worker = `localhost:${DEFAULT_AGENT_PORT}`;
    } else {
      console.error('No worker configured. Run: perry config worker <hostname>');
      process.exit(1);
    }
  }
  return worker;
}

program
  .command('list')
  .alias('ls')
  .description('List all workspaces')
  .action(async () => {
    try {
      const client = await getClient();
      const workspaces = await client.listWorkspaces();

      if (workspaces.length === 0) {
        console.log('No workspaces found.');
        return;
      }

      console.log('');
      for (const ws of workspaces) {
        const status = ws.status === 'running' ? '●' : '○';
        console.log(`  ${status} ${ws.name}`);
        console.log(`    Status: ${ws.status}`);
        if (ws.repo) {
          console.log(`    Repo: ${ws.repo}`);
        }
        console.log(`    SSH Port: ${ws.ports.ssh}`);
        console.log(`    Created: ${new Date(ws.created).toLocaleString()}`);
        console.log('');
      }
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('start <name>')
  .description('Start a workspace (creates it if it does not exist)')
  .option('--clone <url>', 'Git repository URL to clone (when creating)')
  .action(async (name, options) => {
    try {
      const client = await getClient();
      console.log(`Starting workspace '${name}'...`);

      const workspace = await client.startWorkspace(name, { clone: options.clone });

      console.log(`Workspace '${workspace.name}' started.`);
      console.log(`  Status: ${workspace.status}`);
      console.log(`  SSH Port: ${workspace.ports.ssh}`);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('stop <name>')
  .description('Stop a running workspace')
  .action(async (name) => {
    try {
      const client = await getClient();
      console.log(`Stopping workspace '${name}'...`);

      const workspace = await client.stopWorkspace(name);

      console.log(`Workspace '${workspace.name}' stopped.`);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('delete <name>')
  .alias('rm')
  .description('Delete a workspace')
  .action(async (name) => {
    try {
      const client = await getClient();
      console.log(`Deleting workspace '${name}'...`);

      await client.deleteWorkspace(name);

      console.log(`Workspace '${name}' deleted.`);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('clone <source> <clone-name>')
  .description('Clone an existing workspace')
  .action(async (source, cloneName) => {
    try {
      const client = await getClient();
      console.log(`Cloning workspace '${source}' to '${cloneName}'...`);
      console.log('This may take a while for large workspaces.');

      const workspace = await client.cloneWorkspace(source, cloneName);

      console.log(`Workspace '${cloneName}' created.`);
      console.log(`  Status: ${workspace.status}`);
      console.log(`  SSH Port: ${workspace.ports.ssh}`);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('info [name]')
  .description('Show workspace or agent info')
  .action(async (name) => {
    try {
      const client = await getClient();

      if (name) {
        const workspace = await client.getWorkspace(name);
        console.log(`Workspace: ${workspace.name}`);
        console.log(`  Status: ${workspace.status}`);
        console.log(`  Container ID: ${workspace.containerId.slice(0, 12)}`);
        if (workspace.repo) {
          console.log(`  Repo: ${workspace.repo}`);
        }
        console.log(`  SSH Port: ${workspace.ports.ssh}`);
        console.log(`  Created: ${new Date(workspace.created).toLocaleString()}`);
      } else {
        const info = await client.info();
        console.log(`Agent Info:`);
        console.log(`  Hostname: ${info.hostname}`);
        console.log(`  Uptime: ${formatUptime(info.uptime)}`);
        console.log(`  Workspaces: ${info.workspacesCount}`);
        console.log(`  Docker: ${info.dockerVersion}`);
        if (info.tailscale?.running) {
          console.log(`  Tailscale: ${info.tailscale.dnsName}`);
          if (info.tailscale.httpsUrl) {
            console.log(`  HTTPS URL: ${info.tailscale.httpsUrl}`);
          }
        }
      }
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('logs <name>')
  .description('Show workspace logs')
  .option('-n, --tail <lines>', 'Number of lines to show', '100')
  .action(async (name, options) => {
    try {
      const client = await getClient();
      const logs = await client.getLogs(name, parseInt(options.tail, 10));
      console.log(logs);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('sync <name>')
  .description('Sync credentials and files to a running workspace')
  .action(async (name) => {
    try {
      const client = await getClient();
      console.log(`Syncing credentials to workspace '${name}'...`);

      await client.syncWorkspace(name);

      console.log(`Workspace '${name}' synced.`);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('shell <name>')
  .description('Open interactive terminal to workspace')
  .action(async (name) => {
    try {
      const worker = await getWorkerWithFallback();
      const client = await getClient();

      const workspace = await client.getWorkspace(name);
      if (workspace.status !== 'running') {
        console.error(`Workspace '${name}' is not running (status: ${workspace.status})`);
        process.exit(1);
      }

      if (isLocalWorker(worker)) {
        const containerName = getContainerName(name);
        await openDockerExec({
          containerName,
          onError: (err) => {
            console.error(`\nConnection error: ${err.message}`);
          },
        });
      } else {
        const wsUrl = getTerminalWSUrl(worker, name);
        await openWSShell({
          url: wsUrl,
          onError: (err) => {
            console.error(`\nConnection error: ${err.message}`);
          },
        });
      }
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('proxy <name> [ports...]')
  .description('Forward ports from workspace to local machine')
  .action(async (name, ports: string[]) => {
    try {
      const worker = await getWorkerWithFallback();
      const client = await getClient();

      const workspace = await client.getWorkspace(name);
      if (workspace.status !== 'running') {
        console.error(`Workspace '${name}' is not running (status: ${workspace.status})`);
        process.exit(1);
      }

      let effectivePorts = ports;
      if (ports.length === 0) {
        const configuredForwards = workspace.ports.forwards || [];
        if (configuredForwards.length === 0) {
          console.log(`No ports configured for workspace '${name}'.`);
          console.log('');
          console.log('Configure ports with: perry ports <name> <port> [<port>...]');
          console.log('  Example: perry ports ' + name + ' 3000 5173');
          console.log('');
          console.log('Or specify ports directly: perry proxy <name> <port> [<port>...]');
          console.log('  Example: perry proxy ' + name + ' 3000 5173');
          return;
        }
        effectivePorts = configuredForwards.map((p) => String(p));
        console.log(`Using configured ports: ${configuredForwards.join(', ')}`);
      }

      if (isLocalWorker(worker)) {
        const containerName = getContainerName(name);
        const containerIp = await getContainerIp(containerName);
        if (!containerIp) {
          console.error(`Could not get IP for container '${containerName}'`);
          process.exit(1);
        }

        const forwards = effectivePorts.map(parseDockerPortForward);
        console.log(`Forwarding ports: ${formatDockerPortForwards(forwards)}`);
        console.log(`Container IP: ${containerIp}`);
        console.log('Press Ctrl+C to stop.');
        console.log('');

        const cleanup = await startDockerProxy({
          containerIp,
          forwards,
          onConnect: (port) => {
            console.log(`Listening on 0.0.0.0:${port}`);
          },
          onError: (err) => {
            console.error(`Proxy error: ${err.message}`);
          },
        });

        const handleSignal = () => {
          console.log('\nStopping proxy...');
          cleanup();
          process.exit(0);
        };
        process.on('SIGINT', handleSignal);
        process.on('SIGTERM', handleSignal);

        await new Promise(() => {});
      } else {
        const forwards = effectivePorts.map(parsePortForward);

        console.log(`Forwarding ports: ${formatPortForwards(forwards)}`);
        console.log('Press Ctrl+C to stop.');
        console.log('');

        await startProxy({
          worker,
          sshPort: workspace.ports.ssh,
          forwards,
          onConnect: () => {
            console.log('Connected. Ports are now forwarded.');
          },
          onDisconnect: (code) => {
            console.log(`\nDisconnected (exit code: ${code})`);
          },
          onError: (err) => {
            console.error(`\nConnection error: ${err.message}`);
          },
        });
      }
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('ports <name> [ports...]')
  .description('Configure ports to forward for a workspace')
  .action(async (name, ports: string[]) => {
    try {
      const client = await getClient();

      const workspace = await client.getWorkspace(name);
      if (!workspace) {
        console.error(`Workspace '${name}' not found`);
        process.exit(1);
      }

      if (ports.length === 0) {
        const currentPorts = workspace.ports.forwards || [];
        if (currentPorts.length === 0) {
          console.log(`No ports configured for workspace '${name}'.`);
          console.log('');
          console.log('Usage: perry ports <name> <port> [<port>...]');
          console.log('  Example: perry ports ' + name + ' 3000 5173 8080');
        } else {
          console.log(`Ports configured for '${name}': ${currentPorts.join(', ')}`);
        }
        return;
      }

      const portNumbers = ports.map((p) => {
        const num = parseInt(p, 10);
        if (isNaN(num) || num < 1 || num > 65535) {
          console.error(`Invalid port number: ${p}`);
          process.exit(1);
        }
        return num;
      });

      await client.setPortForwards(name, portNumbers);
      console.log(`Ports configured for '${name}': ${portNumbers.join(', ')}`);
      console.log('');
      console.log(`Run 'perry proxy ${name}' to start forwarding.`);
    } catch (err) {
      handleError(err);
    }
  });

const configCmd = program.command('config').description('Manage configuration');

configCmd
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    const clientConfig = await loadClientConfig();
    const configDir = getConfigDir();

    console.log('Client Configuration:');
    console.log(`  Config Dir: ${configDir}`);
    console.log(`  Worker: ${clientConfig?.worker || '(not set)'}`);
  });

configCmd
  .command('worker [hostname]')
  .description('Get or set the worker hostname')
  .action(async (hostname) => {
    if (hostname) {
      await setWorker(hostname);
      console.log(`Worker set to: ${hostname}`);
    } else {
      const worker = await getWorker();
      if (worker) {
        console.log(worker);
      } else {
        console.log('No worker configured.');
      }
    }
  });

configCmd
  .command('agent')
  .description('Show agent configuration')
  .action(async () => {
    const configDir = getConfigDir();
    await ensureConfigDir(configDir);
    const config = await loadAgentConfig(configDir);

    console.log('Agent Configuration:');
    console.log(`  Port: ${config.port}`);
    console.log(`  Environment Variables: ${Object.keys(config.credentials.env).length}`);
    for (const key of Object.keys(config.credentials.env)) {
      console.log(`    - ${key}`);
    }
    console.log(`  Credential Files: ${Object.keys(config.credentials.files).length}`);
    for (const [dest, src] of Object.entries(config.credentials.files)) {
      console.log(`    - ${dest} <- ${src}`);
    }
    const scripts = config.scripts.post_start;
    if (scripts && scripts.length > 0) {
      console.log(`  Post-start Scripts: ${scripts.length}`);
      for (const script of scripts) {
        console.log(`    - ${script}`);
      }
    }
    if (config.scripts.fail_on_error) {
      console.log(`  Scripts Fail on Error: enabled`);
    }
  });

const sshCmd = program.command('ssh').description('Manage SSH keys for workspaces');

sshCmd
  .command('list')
  .description('List detected SSH keys on host')
  .action(async () => {
    const keys = await discoverSSHKeys();

    if (keys.length === 0) {
      console.log('No SSH keys found in ~/.ssh/');
      return;
    }

    console.log('');
    console.log('Detected SSH keys:');
    console.log('');
    for (const key of keys) {
      const privStatus = key.hasPrivateKey ? '✓' : '✗';
      console.log(`  ${key.name}`);
      console.log(`    Type: ${key.type.toUpperCase()}`);
      console.log(`    Fingerprint: ${key.fingerprint}`);
      console.log(`    Private key: ${privStatus}`);
      console.log(`    Path: ${key.path}`);
      console.log('');
    }
  });

sshCmd
  .command('show')
  .description('Show current SSH configuration')
  .action(async () => {
    const configDir = getConfigDir();
    await ensureConfigDir(configDir);
    const config = await loadAgentConfig(configDir);
    const ssh = config.ssh!;

    console.log('');
    console.log('SSH Configuration:');
    console.log(`  Auto-authorize host keys: ${ssh.autoAuthorizeHostKeys ? 'yes' : 'no'}`);
    console.log('');

    console.log('  Keys to copy (global):');
    if (ssh.global.copy.length === 0) {
      console.log('    (none)');
    } else {
      for (const key of ssh.global.copy) {
        console.log(`    - ${key}`);
      }
    }
    console.log('');

    console.log('  Keys to authorize (global):');
    if (ssh.global.authorize.length === 0) {
      console.log('    (none)');
    } else {
      for (const key of ssh.global.authorize) {
        console.log(`    - ${key}`);
      }
    }

    if (Object.keys(ssh.workspaces).length > 0) {
      console.log('');
      console.log('  Per-workspace overrides:');
      for (const [ws, wsConfig] of Object.entries(ssh.workspaces)) {
        console.log(`    ${ws}:`);
        if (wsConfig.copy) {
          console.log(`      copy: ${wsConfig.copy.join(', ')}`);
        }
        if (wsConfig.authorize) {
          console.log(`      authorize: ${wsConfig.authorize.join(', ')}`);
        }
      }
    }
    console.log('');
  });

sshCmd
  .command('auto-authorize [toggle]')
  .description('Toggle auto-authorization of host keys (on/off)')
  .action(async (toggle?: string) => {
    const configDir = getConfigDir();
    await ensureConfigDir(configDir);
    const config = await loadAgentConfig(configDir);

    if (!toggle) {
      console.log(`Auto-authorize host keys: ${config.ssh!.autoAuthorizeHostKeys ? 'on' : 'off'}`);
      return;
    }

    if (toggle !== 'on' && toggle !== 'off') {
      console.error('Usage: perry ssh auto-authorize [on|off]');
      process.exit(1);
    }

    config.ssh!.autoAuthorizeHostKeys = toggle === 'on';
    await saveAgentConfig(config, configDir);
    console.log(`Auto-authorize host keys: ${toggle}`);
  });

sshCmd
  .command('copy <key-path>')
  .description('Add SSH key to copy list (for git, etc)')
  .option('-w, --workspace <name>', 'Apply to specific workspace only')
  .action(async (keyPath: string, options: { workspace?: string }) => {
    const configDir = getConfigDir();
    await ensureConfigDir(configDir);
    const config = await loadAgentConfig(configDir);

    const normalizedPath = keyPath.replace(/\.pub$/, '');

    if (options.workspace) {
      if (!config.ssh!.workspaces[options.workspace]) {
        config.ssh!.workspaces[options.workspace] = {};
      }
      const ws = config.ssh!.workspaces[options.workspace];
      if (!ws.copy) {
        ws.copy = [...config.ssh!.global.copy];
      }
      if (!ws.copy.includes(normalizedPath)) {
        ws.copy.push(normalizedPath);
      }
      console.log(`Added ${normalizedPath} to copy list for workspace '${options.workspace}'`);
    } else {
      if (!config.ssh!.global.copy.includes(normalizedPath)) {
        config.ssh!.global.copy.push(normalizedPath);
      }
      console.log(`Added ${normalizedPath} to global copy list`);
    }

    await saveAgentConfig(config, configDir);
  });

sshCmd
  .command('authorize <key-path>')
  .description('Add SSH key to authorized_keys list')
  .option('-w, --workspace <name>', 'Apply to specific workspace only')
  .action(async (keyPath: string, options: { workspace?: string }) => {
    const configDir = getConfigDir();
    await ensureConfigDir(configDir);
    const config = await loadAgentConfig(configDir);

    if (options.workspace) {
      if (!config.ssh!.workspaces[options.workspace]) {
        config.ssh!.workspaces[options.workspace] = {};
      }
      const ws = config.ssh!.workspaces[options.workspace];
      if (!ws.authorize) {
        ws.authorize = [...config.ssh!.global.authorize];
      }
      if (!ws.authorize.includes(keyPath)) {
        ws.authorize.push(keyPath);
      }
      console.log(`Added ${keyPath} to authorize list for workspace '${options.workspace}'`);
    } else {
      if (!config.ssh!.global.authorize.includes(keyPath)) {
        config.ssh!.global.authorize.push(keyPath);
      }
      console.log(`Added ${keyPath} to global authorize list`);
    }

    await saveAgentConfig(config, configDir);
  });

sshCmd
  .command('remove <key-path>')
  .description('Remove SSH key from copy or authorize list')
  .option('-w, --workspace <name>', 'Remove from specific workspace only')
  .option('--copy', 'Remove from copy list')
  .option('--authorize', 'Remove from authorize list')
  .action(
    async (
      keyPath: string,
      options: { workspace?: string; copy?: boolean; authorize?: boolean }
    ) => {
      const configDir = getConfigDir();
      await ensureConfigDir(configDir);
      const config = await loadAgentConfig(configDir);

      const normalizedPath = keyPath.replace(/\.pub$/, '');
      const removeFromCopy = options.copy || (!options.copy && !options.authorize);
      const removeFromAuthorize = options.authorize || (!options.copy && !options.authorize);

      if (options.workspace) {
        const ws = config.ssh!.workspaces[options.workspace];
        if (ws) {
          if (removeFromCopy && ws.copy) {
            ws.copy = ws.copy.filter((k) => k !== normalizedPath && k !== keyPath);
          }
          if (removeFromAuthorize && ws.authorize) {
            ws.authorize = ws.authorize.filter((k) => k !== normalizedPath && k !== keyPath);
          }
        }
        console.log(`Removed ${keyPath} from workspace '${options.workspace}'`);
      } else {
        if (removeFromCopy) {
          config.ssh!.global.copy = config.ssh!.global.copy.filter(
            (k) => k !== normalizedPath && k !== keyPath
          );
        }
        if (removeFromAuthorize) {
          config.ssh!.global.authorize = config.ssh!.global.authorize.filter(
            (k) => k !== normalizedPath && k !== keyPath
          );
        }
        console.log(`Removed ${keyPath} from global config`);
      }

      await saveAgentConfig(config, configDir);
    }
  );

program
  .command('update')
  .description('Update Perry to the latest version')
  .option('-f, --force', 'Force update even if already on latest version')
  .action(async (options) => {
    const { fetchLatestVersionWithDetails, compareVersions } = await import('./update-checker.js');
    const currentVersion = pkg.version;

    console.log(`Current version: ${currentVersion}`);
    console.log('Checking for updates...');

    const result = await fetchLatestVersionWithDetails();

    if (!result.version) {
      // Only show detailed error messages in interactive mode (TTY)
      if (process.stderr.isTTY) {
        if (result.status === 504) {
          console.error(
            'GitHub API returned 504 Gateway Timeout. This is usually a temporary issue.'
          );
          console.error('Please try again in a few moments.');
        } else if (result.status === 403) {
          console.error('GitHub API rate limit exceeded. Please try again later.');
        } else if (result.error) {
          console.error(`Failed to fetch latest version: ${result.error}`);
        } else {
          console.error('Failed to fetch latest version. Please try again later.');
        }
      }
      process.exit(1);
    }

    const latestVersion = result.version;
    console.log(`Latest version: ${latestVersion}`);

    if (compareVersions(currentVersion, latestVersion) <= 0 && !options.force) {
      console.log('Already up to date.');
      process.exit(0);
    }

    console.log(`Updating Perry from ${currentVersion} to ${latestVersion}...`);

    const { spawn } = await import('child_process');
    const child = spawn(
      'bash',
      ['-c', 'curl -fsSL https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash'],
      {
        stdio: 'inherit',
      }
    );
    child.on('close', (code) => {
      process.exit(code ?? 0);
    });
  });

program
  .command('build')
  .description('Build the workspace Docker image')
  .option('--no-cache', 'Build without cache')
  .action(async (options) => {
    const buildContext = './perry';

    console.log(`Building workspace image ${WORKSPACE_IMAGE_LOCAL}...`);

    try {
      await buildImage(WORKSPACE_IMAGE_LOCAL, buildContext, {
        noCache: options.noCache === false ? false : !options.cache,
      });
      console.log('Build complete.');
    } catch (err) {
      console.error('Build failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

const workerCmd = program
  .command('worker')
  .description('Worker mode commands (for use inside containers)');

workerCmd
  .command('sessions')
  .argument('<subcommand>', 'Subcommand: list, messages, or delete')
  .argument('[sessionId]', 'Session ID (required for messages and delete)')
  .description('Manage OpenCode sessions')
  .action(async (subcommand: string, sessionId?: string) => {
    const { listOpencodeSessions, getOpencodeSessionMessages, deleteOpencodeSession } =
      await import('./sessions/agents/opencode-storage');

    if (subcommand === 'list') {
      const sessions = await listOpencodeSessions();
      console.log(JSON.stringify(sessions));
    } else if (subcommand === 'messages') {
      if (!sessionId) {
        console.error('Usage: perry worker sessions messages <session_id>');
        process.exit(1);
      }
      const result = await getOpencodeSessionMessages(sessionId);
      console.log(JSON.stringify(result));
    } else if (subcommand === 'delete') {
      if (!sessionId) {
        console.error('Usage: perry worker sessions delete <session_id>');
        process.exit(1);
      }
      const result = await deleteOpencodeSession(sessionId);
      console.log(JSON.stringify(result));
    } else {
      console.error(`Unknown subcommand: ${subcommand}`);
      console.error('Available: list, messages, delete');
      process.exit(1);
    }
  });

workerCmd
  .command('serve')
  .option('--port <port>', 'Port to listen on', '7392')
  .description('Start worker API server')
  .action(async (opts) => {
    const { startWorkerServer } = await import('./worker/server');
    await startWorkerServer({ port: parseInt(opts.port, 10) });
  });

function handleError(err: unknown): never {
  if (err instanceof ApiClientError) {
    console.error(`Error: ${err.message}`);
    if (err.code === 'CONNECTION_FAILED') {
      console.error('Make sure the agent is running and accessible.');
    }
  } else if (err instanceof Error) {
    console.error(`Error: ${err.message}`);
  } else if (err && typeof err === 'object') {
    const errObj = err as Record<string, unknown>;
    if ('message' in errObj && typeof errObj.message === 'string') {
      console.error(`Error: ${errObj.message}`);
    } else if ('code' in errObj) {
      console.error(`Error: ${String(errObj.code)}`);
    } else {
      console.error(`Error: ${JSON.stringify(err)}`);
    }
  } else if (err !== undefined && err !== null) {
    console.error(`Error: ${String(err)}`);
  } else {
    console.error('An unknown error occurred');
  }
  process.exit(1);
}

const isWorkerCommand = process.argv[2] === 'worker';
if (!isWorkerCommand) {
  checkForUpdates(pkg.version);
}

program.parse();
