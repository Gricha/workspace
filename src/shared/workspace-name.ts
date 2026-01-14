import { z } from 'zod';

import { HOST_WORKSPACE_NAME } from './client-types';

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

export function isValidWorkspaceName(name: string, options: { allowHost?: boolean } = {}): boolean {
  const trimmed = name.trim();

  if (options.allowHost && trimmed === HOST_WORKSPACE_NAME) {
    return true;
  }

  return isValidUserWorkspaceName(trimmed);
}

export function assertUserWorkspaceName(name: string): string {
  const error = getUserWorkspaceNameError(name);
  if (error) {
    throw new Error(error);
  }
  return name.trim();
}

export function assertAnyWorkspaceName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === HOST_WORKSPACE_NAME) {
    return trimmed;
  }
  return assertUserWorkspaceName(trimmed);
}

export const UserWorkspaceNameSchema = z
  .string()
  .transform((value) => value.trim())
  .superRefine((value, ctx) => {
    const error = getUserWorkspaceNameError(value);
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }
  });

export const AnyWorkspaceNameSchema = z
  .string()
  .transform((value) => value.trim())
  .superRefine((value, ctx) => {
    if (value === HOST_WORKSPACE_NAME) {
      return;
    }

    const error = getUserWorkspaceNameError(value);
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }
  });
