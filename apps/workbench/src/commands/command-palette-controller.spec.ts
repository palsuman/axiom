import { CommandPaletteController, matchesCommandPaletteShortcut } from './command-palette-controller';
import { CommandPaletteService } from './command-palette';
import { CommandRegistry } from './command-registry';

describe('CommandPaletteController', () => {
  it('opens with search results and navigates the active item', async () => {
    const registry = new CommandRegistry();
    registry.register({ id: 'nexus.first', title: 'First Command', handler: jest.fn() });
    registry.register({ id: 'nexus.second', title: 'Second Command', handler: jest.fn() });
    const controller = new CommandPaletteController(new CommandPaletteService(registry), registry);

    await controller.open('command');
    expect(controller.getSnapshot().open).toBe(true);
    expect(controller.getSnapshot().items.length).toBe(2);
    expect(controller.getSnapshot().activeIndex).toBe(0);

    controller.selectNext();
    expect(controller.getSnapshot().activeIndex).toBe(1);

    controller.selectPrevious();
    expect(controller.getSnapshot().activeIndex).toBe(0);
  });

  it('executes the selected item with metadata args and closes afterward', async () => {
    const registry = new CommandRegistry();
    const handler = jest.fn().mockResolvedValue({ ok: true });
    registry.register({
      id: 'nexus.workspace.openPath',
      title: 'Open Workspace',
      handler
    });

    const palette = new CommandPaletteService(registry);
    palette.registerProvider({
      id: 'workspace',
      getItems: () => [
        {
          id: 'workspace:/repo',
          type: 'workspace',
          label: 'Repo',
          score: 1,
          commandId: 'nexus.workspace.openPath',
          metadata: { path: '/repo' }
        }
      ]
    });

    const controller = new CommandPaletteController(palette, registry);

    await controller.open('');
    const result = await controller.executeActive();

    expect(result).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledWith({ path: '/repo' }, undefined);
    expect(controller.getSnapshot().open).toBe(false);
    expect(controller.getSnapshot().error).toBeUndefined();
  });

  it('keeps the palette open and exposes the command error when execution fails', async () => {
    const registry = new CommandRegistry();
    registry.register({
      id: 'nexus.fail',
      title: 'Fail',
      handler: () => {
        throw new Error('boom');
      }
    });

    const controller = new CommandPaletteController(new CommandPaletteService(registry), registry);

    await controller.open('');
    await expect(controller.executeActive()).rejects.toThrow('boom');
    expect(controller.getSnapshot().open).toBe(true);
    expect(controller.getSnapshot().error).toBe('boom');
  });

  it('handles the global command palette shortcut and keyboard actions', async () => {
    const registry = new CommandRegistry();
    const handler = jest.fn().mockResolvedValue(undefined);
    registry.register({
      id: 'nexus.commandPalette.show',
      title: 'Show Command Palette',
      handler
    });
    registry.register({
      id: 'nexus.settings.open',
      title: 'Open Settings',
      handler
    });

    const controller = new CommandPaletteController(new CommandPaletteService(registry), registry);
    const preventDefault = jest.fn();

    expect(
      matchesCommandPaletteShortcut({
        key: 'P',
        metaKey: true,
        shiftKey: true
      })
    ).toBe(true);

    await controller.handleKeydown({
      key: 'P',
      metaKey: true,
      shiftKey: true,
      preventDefault
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(controller.getSnapshot().open).toBe(true);

    await controller.handleKeydown({
      key: 'Enter',
      preventDefault
    });
    expect(handler).toHaveBeenCalled();
    expect(controller.getSnapshot().open).toBe(false);
  });
});
