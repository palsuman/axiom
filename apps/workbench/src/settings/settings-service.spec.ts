import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createDefaultThemeRegistry } from '@nexus/platform/theming/theme-registry';
import { I18nService, WORKBENCH_I18N_BUNDLES } from '../i18n/i18n-service';
import { createDefaultLayoutState, WorkbenchShell } from '../shell/workbench-shell';
import { SettingsService } from './settings-service';

describe('SettingsService', () => {
  let tempDir: string;
  let shell: WorkbenchShell;
  let messages: string[];
  let i18n: I18nService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-settings-service-'));
    i18n = new I18nService({
      locale: 'en-US',
      bundles: WORKBENCH_I18N_BUNDLES
    });
    shell = new WorkbenchShell(createDefaultLayoutState(), { i18n });
    messages = [];
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads persisted user settings and applies theme tokens to the shell', () => {
    const userSettingsPath = path.join(tempDir, 'settings', 'user.json');
    fs.mkdirSync(path.dirname(userSettingsPath), { recursive: true });
    fs.writeFileSync(
      userSettingsPath,
      JSON.stringify(
        {
          'workbench.colorTheme': 'Nexus Light',
          'files.encoding': 'utf16le',
          'editor.tabSize': 4
        },
        null,
        2
      ),
      'utf8'
    );

    const service = new SettingsService({
      shell,
      env: { nexusHome: tempDir, defaultLocale: 'en-US' },
      userSettingsPath,
      i18n,
      logger: message => messages.push(message)
    });

    const snapshot = service.initialize();

    expect(snapshot.user).toMatchObject({
      'workbench.colorTheme': 'Nexus Light',
      'files.encoding': 'utf16le',
      'editor.tabSize': 4
    });
    expect(service.get('files.encoding')).toBe('utf16le');
    expect(service.getThemeRuntime().getSnapshot().activeThemeId).toBe('Nexus Light');
    expect(shell.getThemeTokens()['--nexus-workbench-background']).toBe('#f5f5f5');
    expect(shell.getThemeTokens()['--nexus-font-family-ui']).toContain('IBM Plex Sans');
    expect(shell.getThemeTokens()['--nexus-icon-size-md']).toBe('16px');
    expect(shell.getThemeTokens()['--nexus-activity-bar-width']).toBe('56px');
    expect(messages).toEqual([]);
  });

  it('merges workspace descriptor settings on top of user settings', () => {
    const userSettingsPath = path.join(tempDir, 'settings', 'user.json');
    fs.mkdirSync(path.dirname(userSettingsPath), { recursive: true });
    fs.writeFileSync(
      userSettingsPath,
      JSON.stringify(
        {
          'files.autoSave': 'afterDelay',
          'files.autoSaveDelay': 2000,
          'editor.tabSize': 2
        },
        null,
        2
      ),
      'utf8'
    );

    const workspacePath = path.join(tempDir, 'sample.nexus-workspace.json');
    fs.writeFileSync(
      workspacePath,
      JSON.stringify(
        {
          folders: [{ path: '.' }],
          settings: {
            'files.autoSaveDelay': 400,
            'editor.tabSize': 8
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const service = new SettingsService({
      shell,
      env: { nexusHome: tempDir, defaultLocale: 'en-US' },
      userSettingsPath,
      workspacePath,
      i18n,
      logger: message => messages.push(message)
    });

    const snapshot = service.initialize();

    expect(snapshot.user['files.autoSaveDelay']).toBe(2000);
    expect(snapshot.workspace['files.autoSaveDelay']).toBe(400);
    expect(service.get('files.autoSaveDelay')).toBe(400);
    expect(service.get('editor.tabSize')).toBe(8);
    expect(messages).toEqual([]);
  });

  it('logs validation issues from user and workspace settings without crashing', () => {
    const userSettingsPath = path.join(tempDir, 'settings', 'user.json');
    fs.mkdirSync(path.dirname(userSettingsPath), { recursive: true });
    fs.writeFileSync(
      userSettingsPath,
      JSON.stringify(
        {
          'files.autoSaveDelay': 25,
          'unknown.setting': true
        },
        null,
        2
      ),
      'utf8'
    );

    const workspacePath = path.join(tempDir, 'broken.nexus-workspace.json');
    fs.writeFileSync(
      workspacePath,
      JSON.stringify(
        {
          folders: [{ path: '.' }],
          settings: {
            'workbench.colorTheme': 'Nexus Light'
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const service = new SettingsService({
      shell,
      env: { nexusHome: tempDir, defaultLocale: 'en-US' },
      userSettingsPath,
      workspacePath,
      i18n,
      logger: message => messages.push(message)
    });

    service.initialize();

    expect(service.get('files.autoSaveDelay')).toBe(1000);
    expect(service.get('workbench.colorTheme')).toBe('Nexus Dark');
    expect(messages).toEqual([
      expect.stringContaining('files.autoSaveDelay'),
      expect.stringContaining('unknown.setting'),
      expect.stringContaining('workbench.colorTheme')
    ]);
  });

  it('persists user updates and exposes a schema snapshot', () => {
    const userSettingsPath = path.join(tempDir, 'settings', 'user.json');
    const service = new SettingsService({
      shell,
      env: { nexusHome: tempDir, defaultLocale: 'en-US' },
      userSettingsPath,
      i18n,
      logger: message => messages.push(message)
    });

    service.initialize();
    const snapshot = service.updateUserSettings({
      'files.encoding': 'utf8bom',
      'workbench.colorTheme': 'Nexus High Contrast'
    });

    const persisted = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
    expect(persisted).toEqual({
      'files.encoding': 'utf8bom',
      'workbench.colorTheme': 'Nexus High Contrast'
    });
    expect(snapshot.schema.properties['workbench.colorTheme']).toMatchObject({
      type: 'string',
      scope: 'user'
    });
    expect(shell.getThemeTokens()['--nexus-status-bar-background']).toBe('#ffff00');
    expect(messages).toEqual([]);
  });

  it('derives available color themes from the shared theme registry', () => {
    const userSettingsPath = path.join(tempDir, 'settings', 'user.json');
    const themeRegistry = createDefaultThemeRegistry();
    themeRegistry.register({
      id: 'Nexus Twilight',
      label: 'Nexus Twilight',
      kind: 'dark',
      extends: 'Nexus Dark',
      colors: {
        'panel.background': '#101820',
        'statusBar.background': '#6f42c1'
      }
    });

    fs.mkdirSync(path.dirname(userSettingsPath), { recursive: true });
    fs.writeFileSync(
      userSettingsPath,
      JSON.stringify(
        {
          'workbench.colorTheme': 'Nexus Twilight'
        },
        null,
        2
      ),
      'utf8'
    );

    const service = new SettingsService({
      shell,
      env: { nexusHome: tempDir, defaultLocale: 'en-US' },
      userSettingsPath,
      i18n,
      themeRegistry,
      logger: message => messages.push(message)
    });

    const snapshot = service.initialize();

    expect(snapshot.schema.properties['workbench.colorTheme']).toMatchObject({
      enum: ['Nexus Dark', 'Nexus Light', 'Nexus High Contrast', 'Nexus Twilight']
    });
    expect(shell.getThemeTokens()['--nexus-panel-background']).toBe('#101820');
    expect(shell.getThemeTokens()['--nexus-status-bar-background']).toBe('#6f42c1');
  });

  it('syncs the runtime locale from persisted and updated settings', () => {
    const userSettingsPath = path.join(tempDir, 'settings', 'user.json');
    fs.mkdirSync(path.dirname(userSettingsPath), { recursive: true });
    fs.writeFileSync(
      userSettingsPath,
      JSON.stringify(
        {
          'workbench.locale': 'fr-FR'
        },
        null,
        2
      ),
      'utf8'
    );

    const service = new SettingsService({
      shell,
      env: { nexusHome: tempDir, defaultLocale: 'en-US' },
      userSettingsPath,
      i18n,
      logger: message => messages.push(message)
    });

    service.initialize();
    expect(i18n.getLocale()).toBe('fr-FR');

    service.updateUserSetting('workbench.locale', 'es-ES');
    expect(i18n.getLocale()).toBe('es-ES');
  });

  it('exposes a shared theme runtime that tracks persisted and updated theme selection', () => {
    const userSettingsPath = path.join(tempDir, 'settings', 'user.json');
    fs.mkdirSync(path.dirname(userSettingsPath), { recursive: true });
    fs.writeFileSync(
      userSettingsPath,
      JSON.stringify(
        {
          'workbench.colorTheme': 'Nexus Light'
        },
        null,
        2
      ),
      'utf8'
    );

    const service = new SettingsService({
      shell,
      env: { nexusHome: tempDir, defaultLocale: 'en-US' },
      userSettingsPath,
      i18n,
      logger: message => messages.push(message)
    });

    service.initialize();
    expect(service.getThemeRuntime().getSnapshot().colors['terminal.background']).toBe('#ffffff');
    expect(service.getThemeRuntime().getSnapshot().typography['font.size.md']).toBe('13px');

    service.updateUserSetting('workbench.colorTheme', 'Nexus High Contrast');
    const snapshot = service.getThemeRuntime().getSnapshot();
    expect(snapshot.activeThemeId).toBe('Nexus High Contrast');
    expect(snapshot.colors['statusBar.background']).toBe('#ffff00');
    expect(snapshot.layout['statusBar.height']).toBe('26px');
  });
});
