import { TerminalSnapshotBuffer } from './terminal-snapshot-buffer';

describe('TerminalSnapshotBuffer', () => {
  it('appends data and trims to limit', () => {
    const buffer = new TerminalSnapshotBuffer(10);
    buffer.append('12345');
    buffer.append('67890');
    buffer.append('abc');
    const content = buffer.toString();
    expect(content.length).toBeLessThanOrEqual(10);
    expect(content.endsWith('67890abc')).toBe(true);
  });

  it('resets content', () => {
    const buffer = new TerminalSnapshotBuffer();
    buffer.append('hello');
    buffer.reset('world');
    expect(buffer.toString()).toBe('world');
    buffer.reset();
    expect(buffer.toString()).toBe('');
  });
});
