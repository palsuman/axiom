import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { LaunchConfigurationService } from './launch-configuration-service';

describe('LaunchConfigurationService', () => {
  let tempDir: string;
  let service: LaunchConfigurationService;
  let windows: {
    getSessionMetadataForWebContents: jest.Mock;
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-launch-config-'));
    windows = {
      getSessionMetadataForWebContents: jest.fn(() => ({
        id: 'session-1',
        workspacePrimary: tempDir,
        workspaceRoots: [tempDir],
        lastOpenedAt: Date.now(),
        lastFocusedAt: Date.now()
      }))
    };
    service = new LaunchConfigurationService(windows as never);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns a default serialized document when the workspace has no launch file', async () => {
    const result = await service.load({ id: 11 } as never);

    expect(result.exists).toBe(false);
    expect(result.path).toBe(path.join(tempDir, '.nexus', 'launch.json'));
    expect(result.text).toContain('"configurations"');
    expect(result.issues).toEqual([]);
  });

  it('persists normalized JSON when saving a valid launch configuration document', async () => {
    const result = await service.save(
      { id: 12 } as never,
      {
        text: JSON.stringify(
          {
            version: '1.0.0',
            configurations: [
              {
                name: 'Launch API',
                type: 'node',
                request: 'launch',
                program: '${workspaceFolder}/server.js'
              }
            ]
          },
          null,
          2
        )
      }
    );

    expect(result.saved).toBe(true);
    expect(result.issues).toEqual([]);
    const savedText = fs.readFileSync(path.join(tempDir, '.nexus', 'launch.json'), 'utf8');
    expect(savedText).toContain('"name": "Launch API"');
    expect(savedText).toContain('"console": "integratedTerminal"');
  });

  it('rejects invalid JSON without touching the workspace file', async () => {
    const targetPath = path.join(tempDir, '.nexus', 'launch.json');
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, '{"version":"1.0.0","configurations":[]}', 'utf8');

    const result = await service.save(
      { id: 13 } as never,
      {
        text: '{'
      }
    );

    expect(result.saved).toBe(false);
    expect(result.issues[0]?.path).toBe('$');
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('{"version":"1.0.0","configurations":[]}');
  });
});
