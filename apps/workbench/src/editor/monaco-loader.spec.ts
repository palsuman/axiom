import { MonacoLoader } from './monaco-loader';
import type { MonacoApi } from './monaco-types';

const monacoStub = {
  editor: {
    create: jest.fn(),
    createModel: jest.fn(),
    getModel: jest.fn(),
    defineTheme: jest.fn(),
    setTheme: jest.fn()
  },
  Uri: { parse: jest.fn(() => ({ toString: () => 'inmemory:///test' })) }
} as unknown as MonacoApi;

describe('MonacoLoader', () => {
  it('loads scripts once and resolves monaco API', async () => {
    const loadScript = jest.fn(() => Promise.resolve());
    const requireMock = Object.assign(
      jest.fn((_modules: string[], onLoad: (monaco: MonacoApi) => void) => onLoad(monacoStub)),
      { config: jest.fn() }
    );
    const loader = new MonacoLoader(
      { basePath: '/static/vs' },
      {
        loadScript,
        getGlobal: () => ({
          require: requireMock
        })
      }
    );

    const result = await loader.load();
    expect(result).toBe(monacoStub);
    expect(loadScript).toHaveBeenCalledWith('/static/vs/loader.js');
    expect(requireMock.config).toHaveBeenCalledWith({ paths: { vs: '/static/vs' } });
    expect(requireMock).toHaveBeenCalled();
    // cached result
    await loader.load();
    expect(loadScript).toHaveBeenCalledTimes(1);
  });

  it('throws when browser globals are unavailable', async () => {
    const loader = new MonacoLoader({}, { loadScript: jest.fn(), getGlobal: () => undefined });
    await expect(loader.load()).rejects.toThrow(/browser environment/);
  });
});
