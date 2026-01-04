export const DEFAULT_AGENT_PORT = 7391;

export const SSH_PORT_RANGE_START = 2200;
export const SSH_PORT_RANGE_END = 2400;

export const WORKSPACE_IMAGE = 'workspace:latest';

export const VOLUME_PREFIX = 'workspace-';
export const CONTAINER_PREFIX = 'workspace-';

export const AGENT_SESSION_PATHS = {
  claudeCode: '.claude/projects',
  opencode: '.local/share/opencode/storage',
  codex: '.codex/sessions',
} as const;
