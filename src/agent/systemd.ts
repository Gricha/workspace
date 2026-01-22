import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { DEFAULT_CONFIG_DIR } from '../shared/types';
import { DEFAULT_AGENT_PORT } from '../shared/constants';

const SERVICE_NAME = 'perry-agent';
const SERVICE_DESCRIPTION = 'Perry Agent Daemon';

function getSystemdUserDir(): string {
  return path.join(os.homedir(), '.config', 'systemd', 'user');
}

function getServicePath(): string {
  return path.join(getSystemdUserDir(), `${SERVICE_NAME}.service`);
}

interface InstallOptions {
  port?: number;
  configDir?: string;
  noHostAccess?: boolean;
}

export function generateServiceFile(options: InstallOptions = {}): string {
  const port = options.port || DEFAULT_AGENT_PORT;
  const configDir = options.configDir || DEFAULT_CONFIG_DIR;

  const perryPath = process.execPath;

  const execArgs = ['agent', 'run'];
  if (port !== DEFAULT_AGENT_PORT) {
    execArgs.push('--port', String(port));
  }
  if (configDir !== DEFAULT_CONFIG_DIR) {
    execArgs.push('--config-dir', configDir);
  }
  if (options.noHostAccess) {
    execArgs.push('--no-host-access');
  }

  const envLines = [`Environment=NODE_ENV=production`, `Environment=SHELL=/bin/bash`];

  return `[Unit]
Description=${SERVICE_DESCRIPTION}
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
ExecStart=${perryPath} ${execArgs.join(' ')}
Restart=on-failure
RestartSec=5
${envLines.join('\n')}

[Install]
WantedBy=default.target
`;
}

async function runSystemctl(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('systemctl', ['--user', ...args]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data;
    });
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data;
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        const err = new Error(`systemctl exited with code ${code}: ${stderr}`);
        reject(err);
      }
    });

    proc.on('error', reject);
  });
}

export async function installService(options: InstallOptions = {}): Promise<void> {
  const serviceDir = getSystemdUserDir();
  const servicePath = getServicePath();
  const errors: string[] = [];

  await fs.mkdir(serviceDir, { recursive: true });

  const serviceContent = generateServiceFile(options);
  await fs.writeFile(servicePath, serviceContent, 'utf-8');

  console.log(`Service file written to: ${servicePath}`);

  try {
    await runSystemctl(['daemon-reload']);
    console.log('Systemd daemon reloaded');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to reload systemd daemon: ${msg}`);
    console.error(`Error: Could not reload systemd daemon. ${msg}`);
  }

  try {
    await runSystemctl(['enable', SERVICE_NAME]);
    console.log(`Service ${SERVICE_NAME} enabled`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to enable service: ${msg}`);
    console.error(`Error: Could not enable service. ${msg}`);
  }

  if (errors.length > 0) {
    console.log('');
    console.error('Installation failed with errors:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    console.log('');
    console.log('Manual steps required:');
    console.log('  systemctl --user daemon-reload');
    console.log(`  systemctl --user enable ${SERVICE_NAME}`);
    console.log(`  systemctl --user start ${SERVICE_NAME}`);
    throw new Error('Installation failed: systemd configuration could not be completed');
  }

  try {
    await runSystemctl(['restart', SERVICE_NAME]);
    console.log(`Service ${SERVICE_NAME} started`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Warning: Could not start service. ${msg}`);
    console.log('');
    console.log('Installation complete, but service failed to start.');
    console.log('Try starting manually:');
    console.log(`  systemctl --user start ${SERVICE_NAME}`);
    console.log('');
    console.log('To check status:');
    console.log(`  systemctl --user status ${SERVICE_NAME}`);
    console.log('');
    console.log('To view logs:');
    console.log(`  journalctl --user -u ${SERVICE_NAME} -f`);
    return;
  }

  console.log('');
  console.log('Installation complete! Agent is now running.');
  console.log('');
  console.log('To check status:');
  console.log(`  systemctl --user status ${SERVICE_NAME}`);
  console.log('');
  console.log('To view logs:');
  console.log(`  journalctl --user -u ${SERVICE_NAME} -f`);
}

export async function uninstallService(): Promise<void> {
  const servicePath = getServicePath();

  try {
    await runSystemctl(['stop', SERVICE_NAME]);
    console.log(`Service ${SERVICE_NAME} stopped`);
  } catch {
    // Service might not be running
  }

  try {
    await runSystemctl(['disable', SERVICE_NAME]);
    console.log(`Service ${SERVICE_NAME} disabled`);
  } catch {
    // Service might not be enabled
  }

  try {
    await fs.unlink(servicePath);
    console.log(`Service file removed: ${servicePath}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  try {
    await runSystemctl(['daemon-reload']);
    console.log('Systemd daemon reloaded');
  } catch {
    console.warn('Warning: Could not reload systemd daemon');
  }

  console.log('');
  console.log('Uninstallation complete.');
}

export async function getServiceStatus(): Promise<{
  installed: boolean;
  enabled: boolean;
  running: boolean;
}> {
  const servicePath = getServicePath();

  let installed = false;
  try {
    await fs.access(servicePath);
    installed = true;
  } catch {
    installed = false;
  }

  let enabled = false;
  let running = false;

  if (installed) {
    try {
      await runSystemctl(['is-enabled', SERVICE_NAME]);
      enabled = true;
    } catch {
      enabled = false;
    }

    try {
      await runSystemctl(['is-active', SERVICE_NAME]);
      running = true;
    } catch {
      running = false;
    }
  }

  return { installed, enabled, running };
}

export async function showStatus(): Promise<void> {
  const status = await getServiceStatus();

  console.log(`Service: ${SERVICE_NAME}`);
  console.log(`  Installed: ${status.installed ? 'yes' : 'no'}`);

  if (status.installed) {
    console.log(`  Enabled: ${status.enabled ? 'yes' : 'no'}`);
    console.log(`  Running: ${status.running ? 'yes' : 'no'}`);

    if (status.running) {
      console.log('');
      console.log('Service is running. View logs with:');
      console.log(`  journalctl --user -u ${SERVICE_NAME} -f`);
    } else {
      console.log('');
      console.log('Service is not running. Start with:');
      console.log(`  systemctl --user start ${SERVICE_NAME}`);
    }
  } else {
    console.log('');
    console.log('Service not installed. Install with:');
    console.log('  perry agent install');
  }
}

interface ShowLogsOptions {
  follow?: boolean;
  lines?: number;
}

export async function showLogs(options: ShowLogsOptions = {}): Promise<void> {
  const status = await getServiceStatus();

  if (!status.installed) {
    console.error('Agent service is not installed.');
    console.error('Install with: perry agent install');
    process.exit(1);
  }

  const args = ['--user', '-u', SERVICE_NAME, '--no-pager'];

  if (options.follow) {
    args.push('-f');
  }

  if (options.lines) {
    args.push('-n', String(options.lines));
  }

  const proc = spawn('journalctl', args, {
    stdio: 'inherit',
  });

  proc.on('error', (err) => {
    console.error(`Failed to run journalctl: ${err.message}`);
    process.exit(1);
  });

  proc.on('close', (code) => {
    process.exit(code || 0);
  });
}
