import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CrashService } from './crash-service';
import { createMockEnv } from './test-utils/mock-env';

function createTempEnv() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-crash-'));
  return createMockEnv({ nexusEnv: 'production', autoUpdateEnabled: true, nexusDataDir: tmpDir });
}

describe('CrashService', () => {
  it('writes crash logs and restarts app on user confirmation', () => {
    const env = createTempEnv();
    const windowManager = { persistSessions: jest.fn() } as any;
    const appMock = { on: jest.fn(), relaunch: jest.fn(), exit: jest.fn() } as any;
    const dialogMock = { showMessageBoxSync: jest.fn(() => 0) } as any;
    const shellMock = { openPath: jest.fn() } as any;
    const service = new CrashService(env, windowManager, {
      app: appMock,
      dialog: dialogMock,
      shell: shellMock
    });

    service.captureCrash('test', new Error('Boom'));

    const logPath = path.join(env.nexusDataDir, 'logs', 'crash.log');
    expect(fs.existsSync(logPath)).toBe(true);
    const contents = fs.readFileSync(logPath, 'utf8');
    expect(contents).toContain('Boom');
    expect(appMock.relaunch).toHaveBeenCalled();
    expect(appMock.exit).toHaveBeenCalledWith(0);
    expect(windowManager.persistSessions).toHaveBeenCalled();
    expect(shellMock.openPath).not.toHaveBeenCalled();
  });

  it('opens crash log instead of restarting when requested', () => {
    const env = createTempEnv();
    const windowManager = { persistSessions: jest.fn() } as any;
    const appMock = { on: jest.fn(), relaunch: jest.fn(), exit: jest.fn() } as any;
    const dialogMock = { showMessageBoxSync: jest.fn(() => 2) } as any;
    const shellMock = { openPath: jest.fn() } as any;
    const service = new CrashService(env, windowManager, {
      app: appMock,
      dialog: dialogMock,
      shell: shellMock
    });

    service.captureCrash('test', 'Critical failure');

    expect(shellMock.openPath).toHaveBeenCalled();
    expect(appMock.relaunch).not.toHaveBeenCalled();
    expect(appMock.exit).not.toHaveBeenCalled();
  });
});
