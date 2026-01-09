import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../../src/session-manager/ring-buffer';

describe('RingBuffer', () => {
  it('stores and retrieves items', () => {
    const buffer = new RingBuffer<{ id: number; value: string }>(5);
    buffer.push({ id: 1, value: 'a' });
    buffer.push({ id: 2, value: 'b' });

    const all = buffer.getAll();
    expect(all).toHaveLength(2);
    expect(all[0]).toEqual({ id: 1, value: 'a' });
    expect(all[1]).toEqual({ id: 2, value: 'b' });
  });

  it('overwrites oldest items when full', () => {
    const buffer = new RingBuffer<{ id: number }>(3);
    buffer.push({ id: 1 });
    buffer.push({ id: 2 });
    buffer.push({ id: 3 });
    buffer.push({ id: 4 });

    const all = buffer.getAll();
    expect(all).toHaveLength(3);
    expect(all.map((x) => x.id)).toEqual([2, 3, 4]);
  });

  it('returns items since a given id', () => {
    const buffer = new RingBuffer<{ id: number }>(10);
    for (let i = 1; i <= 5; i++) {
      buffer.push({ id: i });
    }

    const since = buffer.getSince(2);
    expect(since.map((x) => x.id)).toEqual([3, 4, 5]);
  });

  it('returns all items when id is before buffer start', () => {
    const buffer = new RingBuffer<{ id: number }>(3);
    for (let i = 1; i <= 5; i++) {
      buffer.push({ id: i });
    }

    const since = buffer.getSince(1);
    expect(since.map((x) => x.id)).toEqual([3, 4, 5]);
  });

  it('returns empty array when id is latest', () => {
    const buffer = new RingBuffer<{ id: number }>(5);
    for (let i = 1; i <= 3; i++) {
      buffer.push({ id: i });
    }

    const since = buffer.getSince(3);
    expect(since).toEqual([]);
  });

  it('tracks latest id correctly', () => {
    const buffer = new RingBuffer<{ id: number }>(5);
    expect(buffer.getLatestId()).toBe(-1); // No items yet

    buffer.push({ id: 1 });
    expect(buffer.getLatestId()).toBe(0); // First item has ID 0

    buffer.push({ id: 2 });
    buffer.push({ id: 3 });
    expect(buffer.getLatestId()).toBe(2); // Third item has ID 2
  });

  it('clears buffer contents but preserves id sequence', () => {
    const buffer = new RingBuffer<{ id: number }>(5);
    buffer.push({ id: 1 });
    buffer.push({ id: 2 });

    buffer.clear();

    expect(buffer.getAll()).toEqual([]);
    expect(buffer.size()).toBe(0);
  });

  it('handles empty buffer', () => {
    const buffer = new RingBuffer<{ id: number }>(5);

    expect(buffer.getAll()).toEqual([]);
    expect(buffer.getSince(0)).toEqual([]);
    expect(buffer.getLatestId()).toBe(-1); // No items yet
  });
});
