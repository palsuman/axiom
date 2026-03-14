import { CommandRegistry } from './command-registry';
import { CommandPaletteService } from './command-palette';
import { I18nService, WORKBENCH_I18N_BUNDLES } from '../i18n/i18n-service';

describe('CommandPaletteService', () => {
  it('returns command matches sorted by fuzzy score', async () => {
    const registry = new CommandRegistry();
    registry.register({ id: 'nexus.toggleSidebar', title: 'Toggle Sidebar', category: 'View' });
    registry.register({ id: 'nexus.togglePanel', title: 'Toggle Panel', category: 'View' });
    registry.register({ id: 'nexus.openSettings', title: 'Open Settings', category: 'File' });
    const palette = new CommandPaletteService(registry);
    const snapshot = await palette.search('toggle');
    expect(snapshot.items.length).toBeGreaterThanOrEqual(2);
    expect(snapshot.items[0].label).toMatch(/Toggle/i);
  });

  it('records selection history and accepts custom providers', async () => {
    const registry = new CommandRegistry();
    const palette = new CommandPaletteService(registry);
    palette.registerProvider({
      id: 'recent-workspaces',
      getItems: query => {
        if (!query) return [{ id: 'workspace:repo', type: 'workspace', label: 'Repo Workspace', score: 0.5 }];
        return [];
      }
    });
    const snapshot = await palette.search('');
    expect(snapshot.items.find(item => item.id === 'workspace:repo')).toBeTruthy();
    palette.recordSelection(snapshot.items[0]);
    const snapshotAfter = await palette.search('');
    expect(snapshotAfter.history.length).toBe(1);
  });

  it('resolves localized command titles using the active locale', async () => {
    const registry = new CommandRegistry();
    const i18n = new I18nService({
      locale: 'fr-FR',
      bundles: WORKBENCH_I18N_BUNDLES
    });
    registry.register({
      id: 'nexus.commandPalette.show',
      title: {
        key: 'command.commandPalette.show',
        fallback: 'Show Command Palette'
      }
    });
    const palette = new CommandPaletteService(registry, { i18n });

    const snapshot = await palette.search('palette');

    expect(snapshot.items[0]?.label).toBe('Afficher la palette de commandes');
  });
});
