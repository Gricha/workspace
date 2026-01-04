import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  type CliRenderer,
  type SelectOption,
  SelectRenderableEvents,
  type KeyEvent,
} from '@opentui/core';
import { createApiClient, ApiClientError, type ApiClient } from '../client/api';
import { getWorker, setWorker } from '../client/config';
import { openShell } from '../client/shell';
import type { WorkspaceInfo } from '../shared/types';
import { DEFAULT_AGENT_PORT } from '../shared/constants';

type View = 'list' | 'detail';

interface TuiState {
  view: View;
  workspaces: WorkspaceInfo[];
  selectedWorkspace: WorkspaceInfo | null;
  loading: boolean;
  error: string | null;
  worker: string | null;
}

export class WorkspaceTui {
  private renderer!: CliRenderer;
  private client!: ApiClient;
  private state: TuiState = {
    view: 'list',
    workspaces: [],
    selectedWorkspace: null,
    loading: true,
    error: null,
    worker: null,
  };

  private header!: TextRenderable;
  private content!: BoxRenderable;
  private footer!: TextRenderable;
  private workspaceSelect!: SelectRenderable;

  async start(): Promise<void> {
    const worker = await getWorker();

    if (!worker) {
      await this.promptForWorker();
      return;
    }

    this.state.worker = worker;
    this.client = createApiClient(worker);

    this.renderer = await createCliRenderer({
      exitOnCtrlC: true,
      useAlternateScreen: true,
      useMouse: true,
    });

    this.createLayout();
    await this.loadWorkspaces();

    this.renderer.start();
  }

  private async promptForWorker(): Promise<void> {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('');
    console.log('No worker configured.');
    console.log('');

    const hostname = await new Promise<string>((resolve) => {
      rl.question(`Enter worker hostname (e.g., my-desktop:${DEFAULT_AGENT_PORT}): `, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    if (!hostname) {
      console.log('No hostname provided. Exiting.');
      process.exit(1);
    }

    const workerUrl = hostname.includes(':') ? hostname : `${hostname}:${DEFAULT_AGENT_PORT}`;

    console.log(`Connecting to ${workerUrl}...`);

    try {
      const client = createApiClient(workerUrl);
      await client.info();
      console.log('Connected successfully!');
      await setWorker(workerUrl);
      console.log(`Saved to config.`);
      console.log('');

      this.state.worker = workerUrl;
      this.client = client;

      this.renderer = await createCliRenderer({
        exitOnCtrlC: true,
        useAlternateScreen: true,
        useMouse: true,
      });

      this.createLayout();
      await this.loadWorkspaces();

      this.renderer.start();
    } catch (err) {
      if (err instanceof ApiClientError) {
        console.error(`Failed to connect: ${err.message}`);
      } else {
        console.error(`Failed to connect: ${err}`);
      }
      process.exit(1);
    }
  }

  private createLayout(): void {
    const root = this.renderer.root;

    const container = new BoxRenderable(this.renderer, {
      id: 'container',
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      backgroundColor: '#1a1a2e',
    });

    this.header = new TextRenderable(this.renderer, {
      id: 'header',
      content: ' Workspace Manager',
      height: 1,
      bg: '#16213e',
      fg: '#e94560',
    });

    this.content = new BoxRenderable(this.renderer, {
      id: 'content',
      flexGrow: 1,
      flexDirection: 'column',
      padding: 1,
    });

    this.footer = new TextRenderable(this.renderer, {
      id: 'footer',
      content: ' q:quit  n:new  r:refresh  enter:select',
      height: 1,
      bg: '#16213e',
      fg: '#a0a0a0',
    });

    container.add(this.header);
    container.add(this.content);
    container.add(this.footer);
    root.add(container);

    this.setupKeyHandlers();
  }

  private setupKeyHandlers(): void {
    this.renderer.keyInput.on('keypress', async (key: KeyEvent) => {
      if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        this.renderer.destroy();
        process.exit(0);
      }

      if (this.state.view === 'list') {
        if (key.name === 'n') {
          await this.createWorkspace();
        } else if (key.name === 'r') {
          await this.loadWorkspaces();
        }
      } else if (this.state.view === 'detail') {
        if (key.name === 'escape' || key.name === 'backspace') {
          this.showList();
        } else if (key.name === 's') {
          await this.toggleWorkspace();
        } else if (key.name === 'd') {
          await this.deleteWorkspace();
        } else if (key.name === 'return') {
          await this.openShell();
        }
      }
    });
  }

  private async loadWorkspaces(): Promise<void> {
    this.state.loading = true;
    this.state.error = null;
    this.updateContent();

    try {
      this.state.workspaces = await this.client.listWorkspaces();
      this.state.loading = false;
      this.showList();
    } catch (err) {
      this.state.loading = false;
      this.state.error = err instanceof Error ? err.message : 'Failed to load workspaces';
      this.updateContent();
    }
  }

  private showList(): void {
    this.state.view = 'list';
    this.state.selectedWorkspace = null;
    this.content.getChildren().forEach((child) => this.content.remove(child.id));

    if (this.state.loading) {
      const loading = new TextRenderable(this.renderer, {
        id: 'loading',
        content: 'Loading workspaces...',
        fg: '#a0a0a0',
      });
      this.content.add(loading);
      return;
    }

    if (this.state.error) {
      const error = new TextRenderable(this.renderer, {
        id: 'error',
        content: `Error: ${this.state.error}`,
        fg: '#e94560',
      });
      this.content.add(error);
      return;
    }

    if (this.state.workspaces.length === 0) {
      const empty = new TextRenderable(this.renderer, {
        id: 'empty',
        content: 'No workspaces yet. Press n to create one.',
        fg: '#a0a0a0',
      });
      this.content.add(empty);
      return;
    }

    const options: SelectOption[] = this.state.workspaces.map((ws) => ({
      name: `${ws.status === 'running' ? '●' : '○'} ${ws.name}`,
      description: `${ws.status} | SSH: ${ws.ports.ssh}${ws.repo ? ` | ${ws.repo}` : ''}`,
      value: ws,
    }));

    this.workspaceSelect = new SelectRenderable(this.renderer, {
      id: 'workspace-select',
      options,
      flexGrow: 1,
      backgroundColor: '#1a1a2e',
      textColor: '#ffffff',
      focusedBackgroundColor: '#16213e',
      focusedTextColor: '#e94560',
      selectedBackgroundColor: '#0f3460',
      selectedTextColor: '#ffffff',
      showDescription: true,
      descriptionColor: '#a0a0a0',
    });

    this.workspaceSelect.on(SelectRenderableEvents.ITEM_SELECTED, () => {
      const selected = this.workspaceSelect.getSelectedOption();
      if (selected?.value) {
        this.showDetail(selected.value as WorkspaceInfo);
      }
    });

    this.content.add(this.workspaceSelect);
    this.workspaceSelect.focus();

    this.footer.content = ' q:quit  n:new  r:refresh  enter:select';
  }

  private showDetail(workspace: WorkspaceInfo): void {
    this.state.view = 'detail';
    this.state.selectedWorkspace = workspace;
    this.content.getChildren().forEach((child) => this.content.remove(child.id));

    const title = new TextRenderable(this.renderer, {
      id: 'detail-title',
      content: `Workspace: ${workspace.name}`,
      fg: '#e94560',
      marginBottom: 1,
    });

    const status = new TextRenderable(this.renderer, {
      id: 'detail-status',
      content: `Status: ${workspace.status}`,
      fg: workspace.status === 'running' ? '#00ff00' : '#a0a0a0',
    });

    const ssh = new TextRenderable(this.renderer, {
      id: 'detail-ssh',
      content: `SSH Port: ${workspace.ports.ssh}`,
      fg: '#ffffff',
    });

    const created = new TextRenderable(this.renderer, {
      id: 'detail-created',
      content: `Created: ${new Date(workspace.created).toLocaleString()}`,
      fg: '#a0a0a0',
    });

    const actions = new TextRenderable(this.renderer, {
      id: 'detail-actions',
      content: '',
      marginTop: 1,
      fg: '#ffffff',
    });

    if (workspace.status === 'running') {
      actions.content = '[enter] Open Shell  [s] Stop  [d] Delete';
    } else {
      actions.content = '[s] Start  [d] Delete';
    }

    this.content.add(title);
    this.content.add(status);
    this.content.add(ssh);
    if (workspace.repo) {
      const repo = new TextRenderable(this.renderer, {
        id: 'detail-repo',
        content: `Repo: ${workspace.repo}`,
        fg: '#a0a0a0',
      });
      this.content.add(repo);
    }
    this.content.add(created);
    this.content.add(actions);

    this.footer.content = ' q:quit  esc:back  s:start/stop  d:delete  enter:shell';
  }

  private updateContent(): void {
    if (this.state.view === 'list') {
      this.showList();
    }
  }

  private async createWorkspace(): Promise<void> {
    this.renderer.suspend();

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    process.stdout.write('\x1b[?25h');

    const name = await new Promise<string>((resolve) => {
      rl.question('Workspace name: ', (answer) => {
        resolve(answer.trim());
      });
    });

    if (!name) {
      rl.close();
      this.renderer.resume();
      return;
    }

    const clone = await new Promise<string>((resolve) => {
      rl.question('Git repo to clone (optional): ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    console.log(`Creating workspace '${name}'...`);

    try {
      await this.client.createWorkspace({ name, clone: clone || undefined });
      console.log('Workspace created!');
    } catch (err) {
      console.error(`Failed to create workspace: ${err instanceof Error ? err.message : err}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.renderer.resume();
    await this.loadWorkspaces();
  }

  private async toggleWorkspace(): Promise<void> {
    const ws = this.state.selectedWorkspace;
    if (!ws) return;

    try {
      if (ws.status === 'running') {
        this.showMessage(`Stopping ${ws.name}...`);
        await this.client.stopWorkspace(ws.name);
      } else {
        this.showMessage(`Starting ${ws.name}...`);
        await this.client.startWorkspace(ws.name);
      }
      await this.loadWorkspaces();
    } catch (err) {
      this.showMessage(`Error: ${err instanceof Error ? err.message : err}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      this.showDetail(ws);
    }
  }

  private async deleteWorkspace(): Promise<void> {
    const ws = this.state.selectedWorkspace;
    if (!ws) return;

    this.renderer.suspend();

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    process.stdout.write('\x1b[?25h');

    const confirm = await new Promise<string>((resolve) => {
      rl.question(`Delete workspace '${ws.name}'? (y/N): `, (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase());
      });
    });

    if (confirm !== 'y') {
      this.renderer.resume();
      return;
    }

    console.log(`Deleting ${ws.name}...`);

    try {
      await this.client.deleteWorkspace(ws.name);
      console.log('Deleted!');
    } catch (err) {
      console.error(`Failed to delete: ${err instanceof Error ? err.message : err}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.renderer.resume();
    await this.loadWorkspaces();
  }

  private async openShell(): Promise<void> {
    const ws = this.state.selectedWorkspace;
    if (!ws || ws.status !== 'running') return;

    this.renderer.destroy();

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdout.write('\x1b[?1049l');
    process.stdout.write('\x1b[?25h');

    const terminalUrl = this.client.getTerminalUrl(ws.name);

    await openShell({
      terminalUrl,
      onError: (err) => {
        console.error(`Connection error: ${err.message}`);
      },
    });

    process.exit(0);
  }

  private showMessage(message: string): void {
    this.content.getChildren().forEach((child) => this.content.remove(child.id));

    const msg = new TextRenderable(this.renderer, {
      id: 'message',
      content: message,
      fg: '#a0a0a0',
    });
    this.content.add(msg);
  }
}

export async function startTui(): Promise<void> {
  const tui = new WorkspaceTui();
  await tui.start();
}
