export class TerminalSnapshotBuffer {
  private limit: number;
  private readonly chunks: string[] = [];
  private totalBytes = 0;

  constructor(limit = 256 * 1024) {
    this.limit = limit;
  }

  append(value: string) {
    if (!value) return;
    this.chunks.push(value);
    this.totalBytes += byteSize(value);
    this.trim();
  }

  setLimit(limit: number) {
    this.limit = Math.max(0, limit);
    this.trim();
  }

  reset(value = '') {
    this.chunks.length = 0;
    this.totalBytes = 0;
    if (value) {
      this.append(value);
    }
  }

  toString() {
    return this.chunks.join('');
  }

  isEmpty() {
    return this.chunks.length === 0;
  }

  private trim() {
    while (this.limit > 0 && this.totalBytes > this.limit && this.chunks.length > 1) {
      const removed = this.chunks.shift()!;
      this.totalBytes -= byteSize(removed);
    }
    if (this.limit === 0) {
      this.chunks.length = 0;
      this.totalBytes = 0;
    }
  }
}

function byteSize(value: string) {
  return Buffer.byteLength(value, 'utf8');
}
