import path from 'node:path';

import { mountWorkbenchRenderer, resolveWorkbenchRendererEntryPath } from './workbench-renderer-loader';

describe('workbench renderer loader', () => {
  const originalDocument = global.document;
  const originalWindow = global.window;

  afterEach(() => {
    if (originalDocument === undefined) {
      Reflect.deleteProperty(global, 'document');
    } else {
      global.document = originalDocument;
    }
    if (originalWindow === undefined) {
      Reflect.deleteProperty(global, 'window');
    } else {
      global.window = originalWindow;
    }
  });

  it('resolves the compiled workbench DOM renderer relative to preload output', () => {
    const resolved = resolveWorkbenchRendererEntryPath('/tmp/dist/apps/desktop-shell/apps/desktop-shell/src/preload');
    expect(resolved).toBe(
      path.resolve('/tmp/dist/apps/workbench/apps/workbench/src/shell/workbench-dom-renderer.js')
    );
  });

  it('loads the renderer immediately when the document is ready', () => {
    const mountWorkbenchDom = jest.fn();
    const loadModule = jest.fn().mockReturnValue({ mountWorkbenchDom });

    global.document = {
      readyState: 'complete',
      body: { tagName: 'BODY' }
    } as unknown as Document;
    global.window = {
      addEventListener: jest.fn()
    } as unknown as Window & typeof globalThis;

    mountWorkbenchRenderer('/tmp/preload', loadModule);

    expect(loadModule).toHaveBeenCalledWith(resolveWorkbenchRendererEntryPath('/tmp/preload'));
    expect(mountWorkbenchDom).toHaveBeenCalledWith(global.document.body);
  });

  it('waits for DOMContentLoaded when the document is still loading', () => {
    const loadModule = jest.fn().mockReturnValue({ mountWorkbenchDom: jest.fn() });
    let domReadyListener: (() => void) | undefined;

    global.document = {
      readyState: 'loading',
      body: { tagName: 'BODY' }
    } as unknown as Document;
    global.window = {
      addEventListener: jest.fn((event: string, listener: () => void) => {
        if (event === 'DOMContentLoaded') {
          domReadyListener = listener;
        }
      })
    } as unknown as Window & typeof globalThis;

    mountWorkbenchRenderer('/tmp/preload', loadModule);
    expect(loadModule).not.toHaveBeenCalled();

    domReadyListener?.();
    expect(loadModule).toHaveBeenCalledWith(resolveWorkbenchRendererEntryPath('/tmp/preload'));
  });
});
