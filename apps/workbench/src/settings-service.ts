import fs from 'node:fs';
import path from 'node:path';

import type { NexusEnv } from '@nexus/platform/env';
import { readEnv } from '@nexus/platform/env';
import {
  SettingsRegistry,
  type SettingDefinition,
  type SettingInspection,
  type SettingsApplyIssue,
  type SettingsApplyReport,
  type SettingsChangeEvent,
  type SettingsSchemaDocument
} from '@nexus/platform/settings-registry';
import { isWorkspaceDescriptorFile, loadWorkspaceDescriptor } from '@nexus/platform/workspace-descriptor';
import type { WorkbenchShell } from './workbench-shell';
import type { I18nService } from './i18n-service';

type SettingsThemePreset = {
  readonly tokens: Record<string, string>;
};

export type SettingsServiceOptions = {
  shell?: WorkbenchShell;
  workspacePath?: string;
  userSettingsPath?: string;
  env?: Pick<NexusEnv, 'nexusHome' | 'defaultLocale'>;
  logger?: (message: string) => void;
  registry?: SettingsRegistry;
  i18n?: I18nService;
};

export type SettingsSnapshot = {
  readonly schema: SettingsSchemaDocument;
  readonly user: Record<string, unknown>;
  readonly workspace: Record<string, unknown>;
  readonly resolved: Record<string, unknown>;
  readonly userSettingsPath: string;
  readonly workspacePath?: string;
};

const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

const THEME_PRESETS: Record<string, SettingsThemePreset> = {
  'Nexus Dark': {
    tokens: {
      '--nexus-workbench-bg': '#1e1e1e',
      '--nexus-activity-bar-bg': '#252526',
      '--nexus-sidebar-bg': '#1f1f1f',
      '--nexus-panel-bg': '#181818',
      '--nexus-status-bar-bg': '#0d5cab',
      '--nexus-status-bar-fg': '#ffffff'
    }
  },
  'Nexus Light': {
    tokens: {
      '--nexus-workbench-bg': '#f5f5f5',
      '--nexus-activity-bar-bg': '#e3e3e3',
      '--nexus-sidebar-bg': '#ffffff',
      '--nexus-panel-bg': '#fafafa',
      '--nexus-status-bar-bg': '#005fb8',
      '--nexus-status-bar-fg': '#ffffff'
    }
  },
  'Nexus High Contrast': {
    tokens: {
      '--nexus-workbench-bg': '#000000',
      '--nexus-activity-bar-bg': '#000000',
      '--nexus-sidebar-bg': '#050505',
      '--nexus-panel-bg': '#050505',
      '--nexus-status-bar-bg': '#ffff00',
      '--nexus-status-bar-fg': '#000000'
    }
  }
};

export function createDefaultSettingsDefinitions(defaultLocale: string): SettingDefinition[] {
  return [
    {
      key: 'workbench.colorTheme',
      type: 'string',
      description: 'Controls the workbench color theme.',
      defaultValue: 'Nexus Dark',
      enum: Object.keys(THEME_PRESETS),
      scope: 'user'
    },
    {
      key: 'workbench.locale',
      type: 'string',
      description: 'Controls the display language used by the workbench.',
      defaultValue: defaultLocale,
      scope: 'user',
      pattern: LOCALE_PATTERN
    },
    {
      key: 'window.zoomLevel',
      type: 'number',
      description: 'Controls the zoom level of the workbench window.',
      defaultValue: 0,
      minimum: -8,
      maximum: 8,
      scope: 'user'
    },
    {
      key: 'files.encoding',
      type: 'string',
      description: 'The default character set encoding used when opening files.',
      defaultValue: 'utf8'
    },
    {
      key: 'files.autoSave',
      type: 'string',
      description: 'Controls whether dirty editors save automatically.',
      defaultValue: 'off',
      enum: ['off', 'afterDelay']
    },
    {
      key: 'files.autoSaveDelay',
      type: 'integer',
      description: 'Delay in milliseconds before autosave triggers when enabled.',
      defaultValue: 1000,
      minimum: 50,
      maximum: 60000
    },
    {
      key: 'editor.tabSize',
      type: 'integer',
      description: 'Number of spaces rendered for a tab character.',
      defaultValue: 2,
      minimum: 1,
      maximum: 16
    },
    {
      key: 'editor.wordWrap',
      type: 'string',
      description: 'Controls whether the editor wraps long lines.',
      defaultValue: 'off',
      enum: ['off', 'on']
    },
    {
      key: 'terminal.integrated.fontSize',
      type: 'integer',
      description: 'Controls the integrated terminal font size.',
      defaultValue: 13,
      minimum: 6,
      maximum: 32,
      scope: 'user'
    }
  ];
}

export class SettingsService {
  private readonly shell?: WorkbenchShell;
  private readonly workspacePath?: string;
  private readonly userSettingsPath: string;
  private readonly logger: (message: string) => void;
  private readonly registry: SettingsRegistry;
  private readonly workspaceKeys = new Set<string>();
  private readonly i18n?: I18nService;

  constructor(options: SettingsServiceOptions = {}) {
    const env = options.env ?? readEnv();
    this.shell = options.shell;
    this.workspacePath = options.workspacePath;
    this.userSettingsPath = path.resolve(options.userSettingsPath ?? path.join(env.nexusHome, 'settings', 'user.json'));
    this.logger = options.logger ?? (message => console.warn(message));
    this.registry = options.registry ?? new SettingsRegistry();
    this.i18n = options.i18n;
    if (!options.registry) {
      this.registry.registerMany(createDefaultSettingsDefinitions(env.defaultLocale));
    }
    this.registry.onDidChange(event => {
      this.handleRegistryChange(event);
    });
  }

  initialize() {
    const userSettings = this.readSettingsFile(this.userSettingsPath, 'user settings');
    if (userSettings) {
      this.logIssues(this.registry.applyValues('user', userSettings, { source: this.userSettingsPath }));
    }

    this.reloadWorkspaceSettings();
    this.applyShellSettings();

    return this.snapshot();
  }

  reloadWorkspaceSettings() {
    const workspaceSettings = this.readWorkspaceSettings();
    const nextKeys = new Set(Object.keys(workspaceSettings));

    this.workspaceKeys.forEach(key => {
      if (!nextKeys.has(key)) {
        this.registry.removeValue('workspace', key, { source: this.workspacePath });
      }
    });

    this.workspaceKeys.clear();
    nextKeys.forEach(key => this.workspaceKeys.add(key));

    if (nextKeys.size > 0) {
      this.logIssues(this.registry.applyValues('workspace', workspaceSettings, { source: this.workspacePath }));
    }

    return this.snapshot();
  }

  get<T>(key: string): T {
    return this.registry.get<T>(key);
  }

  inspect<T>(key: string): SettingInspection<T> {
    return this.registry.inspect<T>(key);
  }

  listDefinitions() {
    return this.registry.listDefinitions();
  }

  getSchema() {
    return this.registry.toJSONSchema();
  }

  snapshot(): SettingsSnapshot {
    return {
      schema: this.registry.toJSONSchema(),
      user: this.registry.getUserValues(),
      workspace: this.registry.getWorkspaceValues(),
      resolved: this.registry.getResolvedValues(),
      userSettingsPath: this.userSettingsPath,
      workspacePath: this.workspacePath
    };
  }

  updateUserSettings(values: Record<string, unknown>) {
    const report = this.registry.applyValues('user', values, { source: 'api:user-settings' });
    this.logIssues(report);
    this.persistUserSettings();
    return this.snapshot();
  }

  updateUserSetting(key: string, value: unknown) {
    return this.updateUserSettings({ [key]: value });
  }

  removeUserSetting(key: string) {
    this.registry.removeValue('user', key, { source: 'api:user-settings' });
    this.persistUserSettings();
    return this.snapshot();
  }

  onDidChange(listener: (event: SettingsChangeEvent) => void) {
    return this.registry.onDidChange(listener);
  }

  private handleRegistryChange(event: SettingsChangeEvent) {
    if (event.key === 'workbench.colorTheme' || event.key === 'workbench.locale' || event.key === 'window.zoomLevel') {
      this.applyShellSettings();
    }
  }

  private applyShellSettings() {
    this.applyShellTheme();
    this.applyDocumentSettings();
  }

  private applyShellTheme() {
    if (!this.shell) {
      return;
    }
    const themeId = this.get<string>('workbench.colorTheme');
    const preset = THEME_PRESETS[themeId] ?? THEME_PRESETS['Nexus Dark'];
    this.shell.applyThemeOverrides(preset.tokens);
  }

  private applyDocumentSettings() {
    const locale = this.get<string>('workbench.locale');
    this.i18n?.setLocale(locale);
    if (typeof document === 'undefined') {
      return;
    }
    const themeId = this.get<string>('workbench.colorTheme');
    const zoomLevel = this.get<number>('window.zoomLevel');

    document.documentElement.lang = locale;
    document.documentElement.dataset.nexusTheme = themeId;
    document.documentElement.style.setProperty('--nexus-zoom-level', String(zoomLevel));
  }

  private readWorkspaceSettings() {
    if (!this.workspacePath || !isWorkspaceDescriptorFile(this.workspacePath) || !fs.existsSync(this.workspacePath)) {
      return {};
    }
    try {
      return loadWorkspaceDescriptor(this.workspacePath).settings ?? {};
    } catch (error) {
      this.logger(`[settings] Failed to load workspace settings from ${this.workspacePath}: ${(error as Error).message}`);
      return {};
    }
  }

  private readSettingsFile(filePath: string, label: string) {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.logger(`[settings] Ignoring ${label} at ${filePath}: root value must be an object`);
        return {};
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      this.logger(`[settings] Failed to read ${label} at ${filePath}: ${(error as Error).message}`);
      return {};
    }
  }

  private persistUserSettings() {
    fs.mkdirSync(path.dirname(this.userSettingsPath), { recursive: true });
    fs.writeFileSync(this.userSettingsPath, JSON.stringify(sortObject(this.registry.getUserValues()), null, 2), 'utf8');
  }

  private logIssues(report: SettingsApplyReport) {
    report.issues.forEach(issue => {
      this.logger(formatIssue(issue));
    });
  }
}

function sortObject(values: Record<string, unknown>) {
  return Object.keys(values)
    .sort((left, right) => left.localeCompare(right))
    .reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = values[key];
      return sorted;
    }, {});
}

function formatIssue(issue: SettingsApplyIssue) {
  const sourceSuffix = issue.source ? ` [source=${issue.source}]` : '';
  return `[settings] ${issue.message}${sourceSuffix}`;
}
