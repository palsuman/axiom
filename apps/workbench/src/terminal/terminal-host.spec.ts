import { createDefaultThemeRuntime } from '@nexus/platform/theming/theme-runtime';
import { TerminalClient } from './terminal-client';
import { TerminalHost } from './terminal-host';

const terminalState = {
  instances: [] as Array<{
    options: Record<string, unknown> & { theme?: Record<string, string | undefined> };
    loadAddon: jest.Mock;
    open: jest.Mock;
    onData: jest.Mock;
    write: jest.Mock;
    dispose: jest.Mock;
    cols: number;
    rows: number;
    setOption: jest.Mock;
  }>
};

jest.mock('xterm', () => ({
  Terminal: jest.fn().mockImplementation((options: Record<string, unknown> & { theme?: Record<string, string | undefined> }) => {
    const instance = {
      options: { theme: options.theme },
      loadAddon: jest.fn(),
      open: jest.fn(),
      onData: jest.fn(),
      write: jest.fn(),
      dispose: jest.fn(),
      cols: 80,
      rows: 24,
      setOption: jest.fn()
    };
    terminalState.instances.push(instance);
    return instance;
  })
}));

jest.mock('xterm-addon-fit', () => ({
  FitAddon: jest.fn().mockImplementation(() => ({
    fit: jest.fn()
  }))
}));

describe('TerminalHost', () => {
  beforeEach(() => {
    terminalState.instances.length = 0;
  });

  it('updates the terminal theme from the shared theme runtime', () => {
    const runtime = createDefaultThemeRuntime({ initialThemeId: 'Nexus Dark' });
    const host = new TerminalHost({}, {
      create: jest.fn(),
      write: jest.fn(),
      resize: jest.fn(),
      dispose: jest.fn(),
      onData: jest.fn().mockReturnValue(() => undefined),
      onExit: jest.fn().mockReturnValue(() => undefined)
    } as unknown as TerminalClient);

    host.bindThemeRuntime(runtime);
    runtime.setTheme('Nexus Light');

    const instance = terminalState.instances[0];
    expect(instance?.setOption).toHaveBeenCalledWith(
      'theme',
      expect.objectContaining({
        background: '#ffffff',
        foreground: '#24292f',
        cursor: '#24292f'
      })
    );
    expect(instance?.setOption).toHaveBeenCalledWith('fontFamily', expect.stringContaining('IBM Plex Mono'));
    expect(instance?.setOption).toHaveBeenCalledWith('fontSize', 13);
    expect(instance?.setOption).toHaveBeenCalledWith('lineHeight', 20);
    host.dispose();
  });
});
