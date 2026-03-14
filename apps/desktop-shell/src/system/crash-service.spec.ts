import type { app, dialog, shell } from 'electron';
import { CrashService } from './crash-service';
import type { CrashReporter } from './crash-reporting';
import { createMockEnv } from '../test-utils/mock-env';
import type { WindowManager } from '../windowing/window-manager';

describe('CrashService', () => {
  it('restarts app after capturing a local crash report', async () => {
    const env = createMockEnv({ nexusEnv: 'production', autoUpdateEnabled: true });
    const windowManager = { persistSessions: jest.fn() } as unknown as WindowManager;
    const appMock = { on: jest.fn(), relaunch: jest.fn(), exit: jest.fn() } as unknown as typeof app;
    const dialogMock = { showMessageBoxSync: jest.fn(() => 0) } as unknown as typeof dialog;
    const shellMock = { openPath: jest.fn() } as unknown as typeof shell;
    const reporter = {
      capture: jest.fn(() => ({
        report: { reason: 'Boom', id: 'crash-1' },
        localPath: '/tmp/crash.log',
        submitAvailable: false
      })),
      submit: jest.fn()
    } as unknown as Pick<CrashReporter, 'capture' | 'submit'>;
    const service = new CrashService(env, windowManager, {
      app: appMock,
      dialog: dialogMock,
      shell: shellMock,
      reporter
    });

    await service.captureCrash('test', new Error('Boom'));

    expect(reporter.capture).toHaveBeenCalledWith('test', expect.any(Error));
    expect(appMock.relaunch).toHaveBeenCalled();
    expect(appMock.exit).toHaveBeenCalledWith(0);
    expect(windowManager.persistSessions).toHaveBeenCalled();
    expect(shellMock.openPath).not.toHaveBeenCalled();
    expect(dialogMock.showMessageBoxSync).toHaveBeenCalledWith(
      expect.objectContaining({
        buttons: ['Restart Nexus', 'Quit', 'Open Crash Log']
      })
    );
  });

  it('opens crash log instead of restarting when requested', async () => {
    const env = createMockEnv({ nexusEnv: 'production', autoUpdateEnabled: true });
    const windowManager = { persistSessions: jest.fn() } as unknown as WindowManager;
    const appMock = { on: jest.fn(), relaunch: jest.fn(), exit: jest.fn() } as unknown as typeof app;
    const dialogMock = { showMessageBoxSync: jest.fn(() => 2) } as unknown as typeof dialog;
    const shellMock = { openPath: jest.fn() } as unknown as typeof shell;
    const reporter = {
      capture: jest.fn(() => ({
        report: { reason: 'Critical failure', id: 'crash-2' },
        localPath: '/tmp/crash.log',
        submitAvailable: false
      })),
      submit: jest.fn()
    } as unknown as Pick<CrashReporter, 'capture' | 'submit'>;
    const service = new CrashService(env, windowManager, {
      app: appMock,
      dialog: dialogMock,
      shell: shellMock,
      reporter
    });

    await service.captureCrash('test', 'Critical failure');

    expect(shellMock.openPath).toHaveBeenCalledWith('/tmp/crash.log');
    expect(appMock.relaunch).not.toHaveBeenCalled();
    expect(appMock.exit).not.toHaveBeenCalled();
  });

  it('offers an opt-in send action when a remote sink is available', async () => {
    const env = createMockEnv({ nexusEnv: 'production', autoUpdateEnabled: true });
    const windowManager = { persistSessions: jest.fn() } as unknown as WindowManager;
    const appMock = { on: jest.fn(), relaunch: jest.fn(), exit: jest.fn() } as unknown as typeof app;
    const dialogMock = { showMessageBoxSync: jest.fn(() => 0) } as unknown as typeof dialog;
    const shellMock = { openPath: jest.fn() } as unknown as typeof shell;
    const reporter = {
      capture: jest.fn(() => ({
        report: { reason: 'Upload me', id: 'crash-3' },
        localPath: '/tmp/crash.log',
        submitAvailable: true
      })),
      submit: jest.fn().mockResolvedValue({ ok: true, status: 202, requestId: 'req-1' })
    } as unknown as Pick<CrashReporter, 'capture' | 'submit'>;
    const service = new CrashService(env, windowManager, {
      app: appMock,
      dialog: dialogMock,
      shell: shellMock,
      reporter
    });

    await service.captureCrash('test', new Error('Upload me'));

    expect(dialogMock.showMessageBoxSync).toHaveBeenCalledWith(
      expect.objectContaining({
        buttons: ['Send Report and Restart Nexus', 'Restart Nexus', 'Quit', 'Open Crash Log']
      })
    );
    expect(reporter.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'crash-3'
      })
    );
    expect(appMock.relaunch).toHaveBeenCalled();
    expect(appMock.exit).toHaveBeenCalledWith(0);
  });
});
