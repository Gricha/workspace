import { describe, expect, test } from 'vitest';
import { toOpenCodeModelParam } from '../../src/session-manager/adapters/opencode';

describe('toOpenCodeModelParam', () => {
  test('parses provider/model pair', () => {
    expect(toOpenCodeModelParam('opencode/claude-opus-4-5')).toEqual({
      providerID: 'opencode',
      modelID: 'claude-opus-4-5',
    });
  });

  test('parses provider/model pair with extra whitespace', () => {
    expect(toOpenCodeModelParam('  google-vertex/gemini-2.5-pro  ')).toEqual({
      providerID: 'google-vertex',
      modelID: 'gemini-2.5-pro',
    });
  });

  test('returns null when missing provider prefix', () => {
    expect(toOpenCodeModelParam('sonnet')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(toOpenCodeModelParam('')).toBeNull();
  });
});
