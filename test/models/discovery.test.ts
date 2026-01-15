import { describe, test, expect } from 'vitest';
import { parseOpencodeModels, shouldUseCachedOpencodeModels } from '../../src/models/discovery';

describe('parseOpencodeModels', () => {
  test('parses model with provider prefix', () => {
    const output = 'opencode/claude-opus-4-5';
    const models = parseOpencodeModels(output);

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('opencode/claude-opus-4-5');
    expect(models[0].name).toBe('Claude Opus 4 5');
    expect(models[0].provider).toBe('opencode');
  });

  test('includes provider field for disambiguation', () => {
    const output = `opencode/claude-opus-4-5
github-copilot/claude-opus-4.5`;
    const models = parseOpencodeModels(output);

    expect(models).toHaveLength(2);
    expect(models[0].name).toBe('Claude Opus 4 5');
    expect(models[0].provider).toBe('opencode');
    expect(models[1].name).toBe('Claude Opus 4.5');
    expect(models[1].provider).toBe('github-copilot');
    expect(models[0].provider).not.toBe(models[1].provider);
  });

  test('handles model without provider prefix', () => {
    const output = 'sonnet';
    const models = parseOpencodeModels(output);

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('sonnet');
    expect(models[0].name).toBe('Sonnet');
  });

  test('parses multiple models', () => {
    const output = `opencode/claude-opus-4-5
opencode/claude-sonnet-4
opencode/gpt-5
github-copilot/claude-opus-4.5`;
    const models = parseOpencodeModels(output);

    expect(models).toHaveLength(4);
    expect(models.map((m) => m.id)).toEqual([
      'opencode/claude-opus-4-5',
      'opencode/claude-sonnet-4',
      'opencode/gpt-5',
      'github-copilot/claude-opus-4.5',
    ]);
  });

  test('skips empty lines', () => {
    const output = `opencode/claude-opus-4-5

opencode/claude-sonnet-4`;
    const models = parseOpencodeModels(output);

    expect(models).toHaveLength(2);
  });

  test('skips JSON lines', () => {
    const output = `{"error": "some error"}
opencode/claude-opus-4-5`;
    const models = parseOpencodeModels(output);

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('opencode/claude-opus-4-5');
  });

  test('capitalizes each word in model name', () => {
    const output = 'opencode/gpt-5.1-codex-max';
    const models = parseOpencodeModels(output);

    expect(models[0].name).toBe('Gpt 5.1 Codex Max');
    expect(models[0].provider).toBe('opencode');
  });
});

describe('shouldUseCachedOpencodeModels', () => {
  test('uses cached models for workspace-specific requests', () => {
    const cached = [
      { id: 'github-copilot/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'github-copilot' },
    ];

    expect(shouldUseCachedOpencodeModels(cached, true, 'workspace-name')).toBe(true);
  });

  test('skips cache when preferring workspace models without opencode provider', () => {
    const cached = [
      { id: 'github-copilot/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'github-copilot' },
    ];

    expect(shouldUseCachedOpencodeModels(cached, true)).toBe(false);
  });

  test('uses cache when opencode provider is present', () => {
    const cached = [
      { id: 'opencode/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'opencode' },
      { id: 'github-copilot/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'github-copilot' },
    ];

    expect(shouldUseCachedOpencodeModels(cached, true)).toBe(true);
  });

  test('uses cache when workspace models not preferred', () => {
    const cached = [
      { id: 'github-copilot/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'github-copilot' },
    ];

    expect(shouldUseCachedOpencodeModels(cached, false)).toBe(true);
  });

  test('skips cache when cached models are empty', () => {
    expect(shouldUseCachedOpencodeModels([], true)).toBe(false);
  });
});
