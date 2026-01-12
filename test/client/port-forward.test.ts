import { describe, test, expect } from 'vitest';
import { parsePortForward, formatPortForwards } from '../../src/client/port-forward';

describe('parsePortForward', () => {
  test('parses single port as same host and container', () => {
    const result = parsePortForward('3000');
    expect(result).toEqual({ localPort: 3000, remotePort: 3000 });
  });

  test('parses host:container format', () => {
    const result = parsePortForward('8080:3000');
    expect(result).toEqual({ localPort: 8080, remotePort: 3000 });
  });

  test('throws on invalid single port', () => {
    expect(() => parsePortForward('abc')).toThrow('Invalid port');
    expect(() => parsePortForward('0')).toThrow('Invalid port');
    expect(() => parsePortForward('70000')).toThrow('Invalid port');
  });

  test('throws on invalid host port in mapping', () => {
    expect(() => parsePortForward('abc:3000')).toThrow('Invalid local port');
    expect(() => parsePortForward('0:3000')).toThrow('Invalid local port');
  });

  test('throws on invalid container port in mapping', () => {
    expect(() => parsePortForward('8080:abc')).toThrow('Invalid remote port');
    expect(() => parsePortForward('8080:0')).toThrow('Invalid remote port');
  });

  test('handles edge case ports', () => {
    expect(parsePortForward('1')).toEqual({ localPort: 1, remotePort: 1 });
    expect(parsePortForward('65535')).toEqual({ localPort: 65535, remotePort: 65535 });
    expect(parsePortForward('1:65535')).toEqual({ localPort: 1, remotePort: 65535 });
  });
});

describe('formatPortForwards', () => {
  test('formats same port as single number', () => {
    const result = formatPortForwards([{ localPort: 3000, remotePort: 3000 }]);
    expect(result).toBe('3000');
  });

  test('formats different ports as host:container', () => {
    const result = formatPortForwards([{ localPort: 8080, remotePort: 3000 }]);
    expect(result).toBe('8080:3000');
  });

  test('formats multiple ports with comma separator', () => {
    const result = formatPortForwards([
      { localPort: 3000, remotePort: 3000 },
      { localPort: 8080, remotePort: 5173 },
    ]);
    expect(result).toBe('3000, 8080:5173');
  });

  test('handles empty array', () => {
    const result = formatPortForwards([]);
    expect(result).toBe('');
  });
});
