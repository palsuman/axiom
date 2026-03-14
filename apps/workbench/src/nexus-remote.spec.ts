import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const setupRemote = require('../../../tools/cache/nexus-remote.js');

describe('nexus remote cache runner', () => {
  it('stores and retrieves cache artifacts', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-remote-test-'));
    const remoteDir = path.join(tmpDir, 'remote');
    const cacheDir = path.join(tmpDir, 'local');
    const runner = setupRemote({ remoteDir });
    const hash = 'abc123';

    const localHashDir = path.join(cacheDir, hash);
    fs.mkdirSync(localHashDir, { recursive: true });
    fs.writeFileSync(path.join(localHashDir, 'output.txt'), 'cached-output');

    await runner.store(hash, cacheDir);

    fs.rmSync(localHashDir, { recursive: true, force: true });
    const restored = await runner.retrieve(hash, cacheDir);
    expect(restored).toBe(true);
    const restoredContent = fs.readFileSync(path.join(localHashDir, 'output.txt'), 'utf8');
    expect(restoredContent).toBe('cached-output');
  });
});
