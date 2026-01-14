import { HOST_WORKSPACE_NAME } from './api';

export const USER_WORKSPACE_NAME_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function getUserWorkspaceNameError(rawName: string): string | null {
  const name = rawName.trim();

  if (name.length === 0) {
    return 'Workspace name is required';
  }

  if (name === HOST_WORKSPACE_NAME) {
    return 'Workspace name is reserved';
  }

  if (name.length > 63) {
    return 'Workspace name must be 63 characters or less';
  }

  if (!USER_WORKSPACE_NAME_REGEX.test(name)) {
    return 'Use lowercase letters, numbers, and hyphens; start/end with a letter or number';
  }

  return null;
}

export function isValidUserWorkspaceName(name: string): boolean {
  return getUserWorkspaceNameError(name) === null;
}
