import { describe, it, expect } from 'vitest';
import { ORPCError } from '@orpc/server';

function mapErrorToORPC(err: unknown, defaultMessage: string): never {
  const message = err instanceof Error ? err.message : defaultMessage;
  if (message.match(/Workspace '.*' not found/)) {
    throw new ORPCError('NOT_FOUND', { message: 'Workspace not found' });
  }
  if (message.includes('already exists')) {
    throw new ORPCError('CONFLICT', { message });
  }
  throw new ORPCError('INTERNAL_SERVER_ERROR', { message });
}

describe('mapErrorToORPC', () => {
  it('maps workspace not found errors to NOT_FOUND', () => {
    const error = new Error("Workspace 'my-workspace' not found");
    expect(() => mapErrorToORPC(error, 'Failed')).toThrow(ORPCError);

    try {
      mapErrorToORPC(error, 'Failed');
    } catch (e) {
      expect(e).toBeInstanceOf(ORPCError);
      expect((e as ORPCError).code).toBe('NOT_FOUND');
      expect((e as ORPCError).message).toBe('Workspace not found');
    }
  });

  it('does not map workspace image not found to NOT_FOUND', () => {
    const error = new Error('Workspace image not found. Either:\n  1. Run perry build locally');
    expect(() => mapErrorToORPC(error, 'Failed')).toThrow(ORPCError);

    try {
      mapErrorToORPC(error, 'Failed');
    } catch (e) {
      expect(e).toBeInstanceOf(ORPCError);
      expect((e as ORPCError).code).toBe('INTERNAL_SERVER_ERROR');
      expect((e as ORPCError).message).toContain('Workspace image not found');
    }
  });

  it('does not map generic not found errors to NOT_FOUND', () => {
    const error = new Error('File not found');
    expect(() => mapErrorToORPC(error, 'Failed')).toThrow(ORPCError);

    try {
      mapErrorToORPC(error, 'Failed');
    } catch (e) {
      expect(e).toBeInstanceOf(ORPCError);
      expect((e as ORPCError).code).toBe('INTERNAL_SERVER_ERROR');
      expect((e as ORPCError).message).toBe('File not found');
    }
  });

  it('maps already exists errors to CONFLICT', () => {
    const error = new Error("Workspace 'test' already exists");
    expect(() => mapErrorToORPC(error, 'Failed')).toThrow(ORPCError);

    try {
      mapErrorToORPC(error, 'Failed');
    } catch (e) {
      expect(e).toBeInstanceOf(ORPCError);
      expect((e as ORPCError).code).toBe('CONFLICT');
      expect((e as ORPCError).message).toContain('already exists');
    }
  });

  it('maps unknown errors to INTERNAL_SERVER_ERROR', () => {
    const error = new Error('Something went wrong');
    expect(() => mapErrorToORPC(error, 'Failed')).toThrow(ORPCError);

    try {
      mapErrorToORPC(error, 'Failed');
    } catch (e) {
      expect(e).toBeInstanceOf(ORPCError);
      expect((e as ORPCError).code).toBe('INTERNAL_SERVER_ERROR');
      expect((e as ORPCError).message).toBe('Something went wrong');
    }
  });

  it('uses default message for non-Error objects', () => {
    expect(() => mapErrorToORPC('string error', 'Default error message')).toThrow(ORPCError);

    try {
      mapErrorToORPC('string error', 'Default error message');
    } catch (e) {
      expect(e).toBeInstanceOf(ORPCError);
      expect((e as ORPCError).code).toBe('INTERNAL_SERVER_ERROR');
      expect((e as ORPCError).message).toBe('Default error message');
    }
  });
});
