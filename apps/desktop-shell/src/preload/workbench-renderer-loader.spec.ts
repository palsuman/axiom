import path from 'node:path';
import { ANGULAR_RENDERER_FAILED_EVENT, ANGULAR_RENDERER_READY_EVENT } from '@nexus/contracts/renderer';
import {
  mountWorkbenchRenderer,
  resolveAngularRendererAssetPaths
} from './workbench-renderer-loader';

function createDocumentStub() {
  const bodyScripts: Array<Record<string, unknown>> = [];
  const headLinks: Array<Record<string, unknown>> = [];

  const documentRef = {
    readyState: 'complete',
    body: {
      innerHTML: '',
      append: jest.fn((element: Record<string, unknown>) => {
        bodyScripts.push(element);
        const listeners = (element.__listeners as Map<string, () => void>) ?? new Map<string, () => void>();
        listeners.get('load')?.();
      })
    },
    head: {
      append: jest.fn((element: Record<string, unknown>) => {
        headLinks.push(element);
      })
    },
    createElement: jest.fn((tagName: string) => {
      const attrs = new Map<string, string>();
      const listeners = new Map<string, () => void>();

      return {
        tagName,
        __attrs: attrs,
        __listeners: listeners,
        setAttribute(name: string, value: string) {
          attrs.set(name, value);
        },
        addEventListener(event: string, listener: () => void) {
          listeners.set(event, listener);
        }
      };
    }),
    querySelector: jest.fn((selector: string) => {
      if (selector.startsWith('link')) {
        const href = selector.match(/href="([^"]+)"/)?.[1];
        return headLinks.find(element => {
          const attrs = element.__attrs as Map<string, string>;
          return attrs.get('href') === href;
        });
      }

      if (selector.startsWith('script')) {
        const src = selector.match(/src="([^"]+)"/)?.[1];
        return bodyScripts.find(element => {
          const attrs = element.__attrs as Map<string, string>;
          return attrs.get('src') === src;
        });
      }

      return null;
    })
  } as unknown as Document;

  return { documentRef, bodyScripts, headLinks };
}

function createWindowStub() {
  const listeners = new Map<string, EventListener>();
  let timeoutId = 0;

  return {
    listeners,
    windowRef: {
      addEventListener: jest.fn((event: string, listener: EventListener) => {
        listeners.set(event, listener);
      }),
      removeEventListener: jest.fn((event: string) => {
        listeners.delete(event);
      }),
      dispatchEvent: jest.fn((event: Event) => {
        listeners.get(event.type)?.(event);
        return true;
      }),
      setTimeout: jest.fn(() => ++timeoutId),
      clearTimeout: jest.fn()
    } as unknown as Window & typeof globalThis
  };
}

describe('workbench renderer loader', () => {
  const flushAsyncWork = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };

  it('resolves the Angular renderer assets relative to preload output', () => {
    const resolved = resolveAngularRendererAssetPaths('/tmp/dist/apps/desktop-shell/apps/desktop-shell/src/preload');

    expect(resolved.browserRoot).toBe(path.resolve('/tmp/dist/apps/workbench/angular/browser'));
    expect(resolved.mainScriptPath).toBe(path.resolve('/tmp/dist/apps/workbench/angular/browser/main.js'));
  });

  it('mounts Angular as the primary renderer path when assets are available', async () => {
    const { documentRef, bodyScripts, headLinks } = createDocumentStub();
    const { listeners, windowRef } = createWindowStub();

    mountWorkbenchRenderer('/tmp/preload', {
      documentRef,
      windowRef,
      fileExists: jest.fn().mockReturnValue(true)
    });

    listeners.get(ANGULAR_RENDERER_READY_EVENT)?.(new Event(ANGULAR_RENDERER_READY_EVENT));
    await Promise.resolve();

    expect(documentRef.body.innerHTML).toContain('nexus-angular-root');
    expect(headLinks).toHaveLength(1);
    expect(bodyScripts).toHaveLength(2);
  });

  it('renders a failure screen when Angular assets are missing', async () => {
    const { documentRef } = createDocumentStub();
    const { windowRef } = createWindowStub();

    mountWorkbenchRenderer('/tmp/preload', {
      documentRef,
      windowRef,
      fileExists: jest.fn().mockReturnValue(false)
    });

    await Promise.resolve();
    await flushAsyncWork();

    expect(documentRef.body.innerHTML).toContain('Missing Angular renderer asset');
    expect(documentRef.body.innerHTML).toContain('The legacy DOM renderer has been removed');
  });

  it('renders a failure screen when Angular bootstrap reports failure', async () => {
    const { documentRef } = createDocumentStub();
    const { listeners, windowRef } = createWindowStub();

    mountWorkbenchRenderer('/tmp/preload', {
      documentRef,
      windowRef,
      fileExists: jest.fn().mockReturnValue(true),
      timeoutMs: 50
    });

    await flushAsyncWork();
    listeners.get(ANGULAR_RENDERER_FAILED_EVENT)?.(
      new CustomEvent(ANGULAR_RENDERER_FAILED_EVENT, { detail: new Error('bootstrap failed') })
    );
    await flushAsyncWork();

    expect(documentRef.body.innerHTML).toContain('bootstrap failed');
    expect(documentRef.body.innerHTML).toContain('The legacy DOM renderer has been removed');
  });
});
