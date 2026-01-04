#!/usr/bin/env bun

import { Command } from 'commander';
import pkg from '../package.json';
import { startAgent } from './agent/run';
import { installService, uninstallService, showStatus } from './agent/systemd';
import { createApiClient, ApiClientError } from './client/api';
import { loadClientConfig, getWorker, setWorker } from './client/config';
import { openShell } from './client/shell';
import { startProxy, parsePortForward, formatPortForwards } from './client/proxy';
import { loadAgentConfig, getConfigDir, ensureConfigDir } from './config/loader';
import { buildImage } from './docker';
import { DEFAULT_AGENT_PORT, WORKSPACE_IMAGE } from './shared/constants';

const program = new Command();

program
  .name('workspace')
  .description('Distributed development environment orchestrator')
  .version(pkg.version)
  .action(async () => {
    const { startTui } = await import('./tui/index.js');
    await startTui();
  });

const agentCmd = program.command('agent').description('Manage the workspace agent daemon');

agentCmd
  .command('run')
  .description('Start the agent daemon')
  .option('-p, --port <port>', 'Port to listen on', parseInt)
  .option('-c, --config-dir <dir>', 'Configuration directory')
  .action(async (options) => {
    await startAgent({
      port: options.port,
      configDir: options.configDir,
    });
  });

agentCmd
  .command('install')
  .description('Install agent as systemd user service')
  .option('-p, --port <port>', 'Port to listen on', parseInt)
  .option('-c, --config-dir <dir>', 'Configuration directory')
  .action(async (options) => {
    await installService({
      port: options.port,
      configDir: options.configDir,
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
  let worker = await getWorker();

  if (!worker) {
    const localRunning = await checkLocalAgent();
    if (localRunning) {
      worker = `localhost:${DEFAULT_AGENT_PORT}`;
    } else {
      console.error('No worker configured. Run: workspace config worker <hostname>');
      process.exit(1);
    }
  }

  return createApiClient(worker);
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
  .command('create <name>')
  .description('Create a new workspace')
  .option('--clone <url>', 'Git repository URL to clone')
  .action(async (name, options) => {
    try {
      const client = await getClient();
      console.log(`Creating workspace '${name}'...`);

      const workspace = await client.createWorkspace({
        name,
        clone: options.clone,
      });

      console.log(`Workspace '${workspace.name}' created.`);
      console.log(`  Status: ${workspace.status}`);
      console.log(`  SSH Port: ${workspace.ports.ssh}`);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command('start <name>')
  .description('Start a stopped workspace')
  .action(async (name) => {
    try {
      const client = await getClient();
      console.log(`Starting workspace '${name}'...`);

      const workspace = await client.startWorkspace(name);

      console.log(`Workspace '${workspace.name}' started.`);
      console.log(`  Status: ${workspace.status}`);
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
  .command('shell <name>')
  .description('Open interactive terminal to workspace')
  .action(async (name) => {
    try {
      const client = await getClient();

      const workspace = await client.getWorkspace(name);
      if (workspace.status !== 'running') {
        console.error(`Workspace '${name}' is not running (status: ${workspace.status})`);
        process.exit(1);
      }

      const terminalUrl = client.getTerminalUrl(name);

      await openShell({
        terminalUrl,
        onError: (err) => {
          console.error(`\nConnection error: ${err.message}`);
        },
      });
    } catch (err) {
      handleError(err);
    }
  });

async function getWorkerWithFallback(): Promise<string> {
  let worker = await getWorker();
  if (!worker) {
    const localRunning = await checkLocalAgent();
    if (localRunning) {
      worker = `localhost:${DEFAULT_AGENT_PORT}`;
    } else {
      console.error('No worker configured. Run: workspace config worker <hostname>');
      process.exit(1);
    }
  }
  return worker;
}

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

      if (ports.length === 0) {
        console.log(`Workspace '${name}' is running.`);
        console.log(`  SSH Port: ${workspace.ports.ssh}`);
        console.log('');
        console.log('To forward ports manually, run:');
        console.log(
          `  ssh -N -L <local>:<remote> -p ${workspace.ports.ssh} workspace@${worker.split(':')[0]}`
        );
        console.log('');
        console.log('Or use: workspace proxy <name> <port> [<port>...]');
        console.log('  Examples:');
        console.log('    workspace proxy alpha 3000         # Forward port 3000');
        console.log('    workspace proxy alpha 8080:3000    # Forward local 8080 to remote 3000');
        console.log('    workspace proxy alpha 3000 5173    # Forward multiple ports');
        return;
      }

      const forwards = ports.map(parsePortForward);

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
    if (config.scripts.post_start) {
      console.log(`  Post-start Script: ${config.scripts.post_start}`);
    }
  });

program
  .command('build')
  .description('Build the workspace Docker image')
  .option('--no-cache', 'Build without cache')
  .action(async (options) => {
    const buildContext = './workspace';

    console.log(`Building workspace image ${WORKSPACE_IMAGE}...`);

    try {
      await buildImage(WORKSPACE_IMAGE, buildContext, {
        noCache: options.noCache === false ? false : !options.cache,
      });
      console.log('Build complete.');
    } catch (err) {
      console.error('Build failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

function handleError(err: unknown): never {
  if (err instanceof ApiClientError) {
    console.error(`Error: ${err.message}`);
    if (err.code === 'CONNECTION_FAILED') {
      console.error('Make sure the agent is running and accessible.');
    }
  } else if (err instanceof Error) {
    console.error(`Error: ${err.message}`);
  } else {
    console.error('An unknown error occurred');
  }
  process.exit(1);
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

program.parse();
