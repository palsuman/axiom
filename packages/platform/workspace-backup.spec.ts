import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WorkspaceBackupManager } from './workspace-backup';

const sampleContent = {
  documents: [
    {
      uri: '/tmp/project/src/index.ts',
      value: 'const answer = 42;',
      dirty: true,
      languageId: 'typescript',
      encoding: 'utf8',
      eol: '\n',
      version: 3
    }
  ],
  terminals: [
    {
      terminalId: 't1',
      shell: '/bin/zsh',
      cwd: '/tmp/project',
      buffer: 'npm run test\n✔ All good\n'
    }
  ],
  runConfigs: [
    {
      id: 'run.dev',
      label: 'Dev Server',
      command: 'npm',
      args: ['run', 'dev'],
      cwd: '/tmp/project'
    }
  ]
};

describe('WorkspaceBackupManager', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-backup-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('persists and loads snapshots per workspace', () => {
    const manager = new WorkspaceBackupManager({ dataRoot: tempDir });
    const result = manager.save('My Workspace', sampleContent);
    expect(result.workspaceId).toBe('my-workspace');
    expect(result.documents).toBe(1);
    const loaded = manager.load('my-workspace');
    expect(loaded?.documents[0]?.value).toContain('const answer');
    expect(loaded?.terminals[0]?.buffer).toContain('npm run test');
    expect(loaded?.runConfigs[0]?.command).toBe('npm');
  });

  it('truncates oversized backups to respect max bytes', () => {
    const manager = new WorkspaceBackupManager({ dataRoot: tempDir, maxBytes: 512 });
    const bigDoc = { ...sampleContent.documents[0], value: 'x'.repeat(10_000) };
    const result = manager.save('large', { ...sampleContent, documents: [bigDoc] });
    expect(result.truncated).toBe(true);
    const loaded = manager.load('large');
    expect(loaded).not.toBeNull();
    const restoredLength = loaded?.documents[0]?.value.length ?? 0;
    expect(restoredLength).toBeLessThan(bigDoc.value.length);
  });

  it('clears snapshot data for workspace', () => {
    const manager = new WorkspaceBackupManager({ dataRoot: tempDir });
    manager.save('temp', sampleContent);
    expect(manager.load('temp')).not.toBeNull();
    expect(manager.clear('temp')).toBe(true);
    expect(manager.load('temp')).toBeNull();
  });
});
