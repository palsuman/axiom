import { AngularCommandHostService } from './angular-command-host.service';

describe('AngularCommandHostService', () => {
  it('opens the command palette from the canonical shortcut', () => {
    const service = new AngularCommandHostService();
    const preventDefault = jest.fn();

    service.handleKeyboardShortcut({
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      key: 'P',
      preventDefault
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(service.palette().open).toBe(true);
  });

  it('closes the command palette on escape', () => {
    const service = new AngularCommandHostService();
    const preventDefault = jest.fn();

    service.execute('nexus.commandPalette.show');
    service.handleKeyboardShortcut({
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      key: 'Escape',
      preventDefault
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(service.palette().open).toBe(false);
  });
});
