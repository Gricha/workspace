export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private tail = 0;
  private count = 0;
  private nextId = 0;

  constructor(private capacity: number) {
    this.buffer = Array.from({ length: capacity });
  }

  push(item: T): number {
    const id = this.nextId++;
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }

    return id;
  }

  getAll(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head + i) % this.capacity;
      const item = this.buffer[idx];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  getSince(startId: number): T[] {
    const oldestId = this.nextId - this.count;
    if (startId < oldestId) {
      return this.getAll();
    }

    const result: T[] = [];
    const skipCount = startId - oldestId;
    for (let i = skipCount; i < this.count; i++) {
      const idx = (this.head + i) % this.capacity;
      const item = this.buffer[idx];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  getLatestId(): number {
    return this.nextId - 1;
  }

  getOldestId(): number {
    return this.nextId - this.count;
  }

  size(): number {
    return this.count;
  }

  clear(): void {
    this.buffer = Array.from({ length: this.capacity });
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
}
