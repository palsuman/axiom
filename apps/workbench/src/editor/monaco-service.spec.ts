import type { MonacoApi, MonacoEditorInstance, MonacoModel } from './monaco-types';
import { MonacoEditorService, type WorkbenchThemeDefinition } from './monaco-service';
import { MonacoLoader } from './monaco-loader';
import { createDefaultThemeRuntime } from '@nexus/platform/theming/theme-runtime';

function createMonacoStub() {
  const modelMap = new Map<string, MonacoModel>();
  let editorCounter = 0;
  const monaco: MonacoApi = {
    editor: {
      create: jest.fn((_container: HTMLElement, options: { model: MonacoModel }) => {
        const editor = {
          dispose: jest.fn(),
          getId: jest.fn(() => `editor-${editorCounter++}`),
          getModel: jest.fn(() => options.model),
          updateOptions: jest.fn()
        };
        return editor as unknown as MonacoEditorInstance;
      }),
      createModel: jest.fn((value: string, _language: string, uri) => {
        const listeners = new Set<() => void>();
        const model: MonacoModel = {
          uri,
          dispose: jest.fn(),
          getValue: jest.fn(() => value),
          setValue: jest.fn(),
          updateOptions: jest.fn(),
          onDidChangeContent: jest.fn(listener => {
            listeners.add(listener);
            return {
              dispose: () => listeners.delete(listener)
            };
          })
        };
        modelMap.set(uri.toString(), model);
        return model;
      }),
      getModel: jest.fn(uri => modelMap.get(uri.toString()) ?? null),
      defineTheme: jest.fn(),
      setTheme: jest.fn()
    },
    Uri: {
      parse: jest.fn(target => ({
        toString: () => target
      }))
    }
  };

  return { monaco, modelMap };
}

function createLoaderMock(monaco: MonacoApi) {
  let loaded = false;
  return {
    load: jest.fn(async () => {
      loaded = true;
      return monaco;
    }),
    isLoaded: jest.fn(() => loaded)
  };
}

describe('MonacoEditorService', () => {
  it('creates editors and reuses existing models', async () => {
    const { monaco, modelMap } = createMonacoStub();
    const loader = createLoaderMock(monaco);
    const service = new MonacoEditorService({}, loader as unknown as MonacoLoader);
    const container = {} as HTMLElement;
    const init = {
      container,
      uri: 'file:///app.ts',
      value: 'console.log("hi")',
      language: 'typescript'
    };

    await service.createEditor(init);
    await service.createEditor(init);
    expect(monaco.editor.createModel).toHaveBeenCalledTimes(1);
    expect(modelMap.has('file:///app.ts')).toBe(true);
  });

  it('disposes editors and reference-counted models', async () => {
    const { monaco, modelMap } = createMonacoStub();
    const loader = createLoaderMock(monaco);
    const service = new MonacoEditorService({}, loader as unknown as MonacoLoader);
    const container = {} as HTMLElement;
    const init = {
      container,
      uri: 'file:///dispose.ts',
      value: 'let x = 1;',
      language: 'typescript'
    };

    const first = await service.createEditor(init);
    const second = await service.createEditor(init);
    const model = modelMap.get('file:///dispose.ts');
    expect(model).toBeDefined();
    await service.disposeEditor(first);
    expect(model?.dispose).not.toHaveBeenCalled();
    await service.disposeEditor(second);
    expect(model?.dispose).toHaveBeenCalled();
  });

  it('applies deferred themes once Monaco loads', async () => {
    const { monaco } = createMonacoStub();
    const loader = createLoaderMock(monaco);
    const service = new MonacoEditorService({}, loader as unknown as MonacoLoader);
    const theme: WorkbenchThemeDefinition = {
      base: 'vs-dark',
      foreground: '#ffffff',
      background: '#1e1e1e'
    };
    await service.updateWorkbenchTheme('nexus-dark', theme);
    expect(monaco.editor.defineTheme).not.toHaveBeenCalled();
    await service.createEditor({
      container: {} as HTMLElement,
      uri: 'file:///theme.ts',
      value: '',
      language: 'typescript'
    });
    expect(monaco.editor.defineTheme).toHaveBeenCalledWith(
      'nexus-dark',
      expect.objectContaining({
        base: 'vs-dark'
      })
    );
    expect(monaco.editor.setTheme).toHaveBeenCalledWith('nexus-dark');
  });

  it('binds to the shared theme runtime and reapplies when the runtime changes', async () => {
    const { monaco } = createMonacoStub();
    const loader = createLoaderMock(monaco);
    const runtime = createDefaultThemeRuntime({ initialThemeId: 'Nexus Dark' });
    const service = new MonacoEditorService({}, loader as unknown as MonacoLoader);

    service.bindThemeRuntime(runtime);
    await service.createEditor({
      container: {} as HTMLElement,
      uri: 'file:///runtime.ts',
      value: '',
      language: 'typescript'
    });

    runtime.setTheme('Nexus Light');
    await Promise.resolve();
    await Promise.resolve();

    expect(monaco.editor.defineTheme).toHaveBeenLastCalledWith(
      'Nexus Light',
      expect.objectContaining({
        base: 'vs',
        colors: expect.objectContaining({
          'editorLineNumber.foreground': '#6e7781',
          'editorCursor.foreground': '#24292f'
        })
      })
    );
    expect(monaco.editor.setTheme).toHaveBeenLastCalledWith('Nexus Light');
    expect((monaco.editor.create as jest.Mock).mock.results[0]?.value.updateOptions).toHaveBeenCalledWith({
      fontFamily: expect.stringContaining('IBM Plex Mono'),
      fontSize: 13,
      lineHeight: 20
    });
  });
});
