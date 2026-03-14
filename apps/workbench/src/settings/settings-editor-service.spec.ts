import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { I18nService, WORKBENCH_I18N_BUNDLES } from '../i18n/i18n-service';
import { createDefaultLayoutState, WorkbenchShell } from '../shell/workbench-shell';
import { SettingsEditorService } from './settings-editor-service';
import { SettingsService } from './settings-service';

describe('SettingsEditorService', () => {
  let tempDir: string;
  let shell: WorkbenchShell;
  let i18n: I18nService;
  let messages: string[];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-settings-editor-'));
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

  it('opens a form snapshot and keeps JSON in sync with form updates', () => {
    const settingsService = createSettingsService();
    const editorService = new SettingsEditorService({
      settingsService,
      shell
    });

    const openSnapshot = editorService.open({ scope: 'user', mode: 'form' });
    expect(openSnapshot.editorResource).toBe('settings://user/form');
    expect(shell.layoutSnapshot().editors.groups[0]?.tabs[0]?.resource).toBe('settings://user/form');
    expect(openSnapshot.sections.some(section => section.title === 'Files')).toBe(true);

    const updatedSnapshot = editorService.updateSetting('files.autoSave', 'afterDelay');
    expect(updatedSnapshot.jsonText).toContain('"files.autoSave": "afterDelay"');
    expect(settingsService.get('files.autoSave')).toBe('afterDelay');
  });

  it('parses JSON updates and reflects them back into form state instantly', () => {
    const settingsService = createSettingsService();
    const editorService = new SettingsEditorService({
      settingsService,
      shell
    });

    editorService.open({ scope: 'user', mode: 'json' });
    const snapshot = editorService.updateJsonText(
      JSON.stringify(
        {
          'editor.tabSize': 8,
          'files.encoding': 'utf16le'
        },
        null,
        2
      )
    );

    expect(snapshot.issues).toEqual([]);
    expect(settingsService.get('editor.tabSize')).toBe(8);
    expect(settingsService.get('files.encoding')).toBe('utf16le');
    const filesSection = editorService.querySections('user', 'encoding').find(section => section.title === 'Files');
    expect(filesSection?.entries[0]?.value).toBe('utf16le');
  });

  it('retains JSON validation issues without mutating persisted settings', () => {
    const settingsService = createSettingsService();
    const editorService = new SettingsEditorService({
      settingsService,
      shell
    });

    const snapshot = editorService.updateJsonText('{');

    expect(snapshot.issues).toEqual([
      expect.objectContaining({
        scope: 'user',
        source: 'json'
      })
    ]);
    expect(settingsService.get('files.encoding')).toBe('utf8');
  });

  it('supports workspace-scoped settings when a workspace target is active', () => {
    const workspacePath = path.join(tempDir, 'workspace');
    fs.mkdirSync(workspacePath, { recursive: true });
    const settingsService = createSettingsService({ workspacePath });
    const editorService = new SettingsEditorService({
      settingsService,
      shell
    });

    const snapshot = editorService.open({ scope: 'workspace', mode: 'form' });
    expect(snapshot.availableScopes).toEqual(['user', 'workspace']);

    editorService.updateSetting('editor.wordWrap', 'on', 'workspace');
    const workspaceDescriptor = JSON.parse(fs.readFileSync(path.join(workspacePath, '.nexus-workspace.json'), 'utf8'));
    expect(workspaceDescriptor.settings).toEqual({ 'editor.wordWrap': 'on' });
  });

  function createSettingsService(options: { workspacePath?: string } = {}) {
    const userSettingsPath = path.join(tempDir, 'settings', 'user.json');
    const service = new SettingsService({
      shell,
      env: { nexusHome: tempDir, defaultLocale: 'en-US' },
      userSettingsPath,
      workspacePath: options.workspacePath,
      i18n,
      logger: message => messages.push(message)
    });
    service.initialize();
    return service;
  }
});
