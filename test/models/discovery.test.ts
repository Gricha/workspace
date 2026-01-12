import { describe, test, expect } from 'vitest';
import { parseOpencodeModels } from '../../src/models/discovery';

describe('parseOpencodeModels', () => {
  test('parses model with provider prefix', () => {
    const output = 'opencode/claude-opus-4-5';
    const models = parseOpencodeModels(output);

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('opencode/claude-opus-4-5');
    expect(models[0].name).toBe('opencode / Claude Opus 4 5');
  });

  test('includes provider in display name for disambiguation', () => {
    const output = `opencode/claude-opus-4-5
github-copilot/claude-opus-4.5`;
    const models = parseOpencodeModels(output);

    expect(models).toHaveLength(2);
    expect(models[0].name).toBe('opencode / Claude Opus 4 5');
    expect(models[1].name).toBe('github-copilot / Claude Opus 4.5');
    expect(models[0].name).not.toBe(models[1].name);
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

    expect(models[0].name).toBe('opencode / Gpt 5.1 Codex Max');
  });
});
