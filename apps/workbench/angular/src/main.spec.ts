import { ensureAngularWorkbenchHost } from './bootstrap';
import { startAngularWorkbench } from './main';
import { ANGULAR_RENDERER_FAILED_EVENT, ANGULAR_RENDERER_READY_EVENT } from '@nexus/contracts/renderer';

describe('bootstrapAngularWorkbench', () => {
  it('reuses an existing host node when present', () => {
    document.body.innerHTML = '<nexus-angular-root></nexus-angular-root>';

    const host = ensureAngularWorkbenchHost(document);

    expect(host.tagName).toBe('NEXUS-ANGULAR-ROOT');
    expect(document.querySelectorAll('nexus-angular-root')).toHaveLength(1);
  });

  it('creates the host node when absent', () => {
    document.body.innerHTML = '';

    const host = ensureAngularWorkbenchHost(document);

    expect(host.tagName).toBe('NEXUS-ANGULAR-ROOT');
    expect(document.body.lastElementChild).toBe(host);
  });

  it('dispatches a ready event after bootstrap succeeds', async () => {
    const dispatchEvent = jest.fn();

    await startAngularWorkbench(
      jest.fn().mockResolvedValue(undefined),
      { ...window, dispatchEvent } as unknown as Window & typeof globalThis,
      jest.fn()
    );

    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: ANGULAR_RENDERER_READY_EVENT }));
  });

  it('dispatches a failed event after bootstrap errors', async () => {
    const dispatchEvent = jest.fn();
    const reportError = jest.fn();
    const error = new Error('boom');

    await expect(
      startAngularWorkbench(
        jest.fn().mockRejectedValue(error),
        { ...window, dispatchEvent } as unknown as Window & typeof globalThis,
        reportError
      )
    ).rejects.toThrow('boom');

    expect(reportError).toHaveBeenCalledWith('[workbench-angular] failed to bootstrap angular renderer', error);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: ANGULAR_RENDERER_FAILED_EVENT }));
  });
});
