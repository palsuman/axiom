import { UpdateService } from './update-service';
import { createMockEnv } from './test-utils/mock-env';

describe('UpdateService', () => {
  const updaterMock = () => ({
    setFeedURL: jest.fn(),
    checkForUpdates: jest.fn(),
    quitAndInstall: jest.fn(),
    on: jest.fn().mockReturnThis()
  });

  const baseEnv = createMockEnv({ nexusEnv: 'production', autoUpdateEnabled: true });

  it('configures feed url based on channel', () => {
    const mock = updaterMock();
    const svc = new UpdateService(baseEnv, mock as any);
    svc.initialize();
    expect(mock.setFeedURL).toHaveBeenCalledWith({ url: 'https://updates.nexus.dev/stable' });
    expect(mock.checkForUpdates).toHaveBeenCalled();
  });

  it('skips initialization when disabled', () => {
    const mock = updaterMock();
    const svc = new UpdateService({ ...baseEnv, autoUpdateEnabled: false }, mock as any);
    svc.initialize();
    expect(mock.setFeedURL).not.toHaveBeenCalled();
  });

  it('supports manual check and install', () => {
    const mock = updaterMock();
    const svc = new UpdateService(baseEnv, mock as any);
    svc.initialize();
    expect(svc.checkForUpdates()).toBe(true);
    expect(mock.checkForUpdates).toHaveBeenCalledTimes(2);
    expect(svc.quitAndInstall()).toBe(true);
    expect(mock.quitAndInstall).toHaveBeenCalled();
  });
});
