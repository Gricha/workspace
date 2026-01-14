import { describe, expect, it } from 'vitest';

import { HOST_WORKSPACE_NAME } from '../../src/shared/client-types';
import {
  AnyWorkspaceNameSchema,
  UserWorkspaceNameSchema,
  getUserWorkspaceNameError,
  isValidWorkspaceName,
} from '../../src/shared/workspace-name';

describe('workspace name validation', () => {
  it('accepts typical workspace names', () => {
    expect(getUserWorkspaceNameError('my-project')).toBeNull();
    expect(getUserWorkspaceNameError('perrytest-ab12cd')).toBeNull();
    expect(getUserWorkspaceNameError('0')).toBeNull();
    expect(getUserWorkspaceNameError('a1-b2')).toBeNull();
  });

  it('rejects empty or whitespace-only names', () => {
    expect(getUserWorkspaceNameError('')).toBe('Workspace name is required');
    expect(getUserWorkspaceNameError('   ')).toBe('Workspace name is required');
  });

  it('rejects invalid characters and shapes', () => {
    expect(getUserWorkspaceNameError('My-Project')).toBeTruthy();
    expect(getUserWorkspaceNameError('my_project')).toBeTruthy();
    expect(getUserWorkspaceNameError('my.project')).toBeTruthy();
    expect(getUserWorkspaceNameError('my/project')).toBeTruthy();
    expect(getUserWorkspaceNameError('-start')).toBeTruthy();
    expect(getUserWorkspaceNameError('end-')).toBeTruthy();
  });

  it('rejects overly long names', () => {
    const tooLong = 'a'.repeat(64);
    expect(getUserWorkspaceNameError(tooLong)).toBe('Workspace name must be 63 characters or less');
  });

  it('rejects the reserved host workspace name for user workspaces', () => {
    expect(getUserWorkspaceNameError(HOST_WORKSPACE_NAME)).toBe('Workspace name is reserved');
    expect(UserWorkspaceNameSchema.safeParse(HOST_WORKSPACE_NAME).success).toBe(false);
  });

  it('allows the host workspace name when explicitly permitted', () => {
    expect(isValidWorkspaceName(HOST_WORKSPACE_NAME, { allowHost: true })).toBe(true);
    expect(AnyWorkspaceNameSchema.safeParse(HOST_WORKSPACE_NAME).success).toBe(true);
  });
});
