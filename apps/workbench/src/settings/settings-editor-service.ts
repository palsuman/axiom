import type {
  SettingInspection,
  SettingsChangeEvent,
  SettingsScope
} from '@nexus/platform/settings/settings-registry';
import type { WorkbenchShell } from '../shell/workbench-shell';
import type { SettingsService } from './settings-service';

export type SettingsEditorMode = 'form' | 'json';

export type SettingsEditorEntry = {
  readonly key: string;
  readonly title: string;
  readonly category: string;
  readonly description: string;
  readonly type: SettingInspection['definition']['type'];
  readonly scope: SettingInspection['definition']['scope'];
  readonly value: unknown;
  readonly defaultValue: unknown;
  readonly userValue?: unknown;
  readonly workspaceValue?: unknown;
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
  readonly maximum?: number;
};

export type SettingsEditorSection = {
  readonly id: string;
  readonly title: string;
  readonly entries: SettingsEditorEntry[];
};

export type SettingsEditorIssue = {
  readonly scope: SettingsScope;
  readonly message: string;
  readonly source: 'json';
};

export type SettingsEditorSnapshot = {
  readonly activeScope: SettingsScope;
  readonly activeMode: SettingsEditorMode;
  readonly query: string;
  readonly focusedKey?: string;
  readonly availableScopes: SettingsScope[];
  readonly sections: SettingsEditorSection[];
  readonly jsonText: string;
  readonly jsonUri: string;
  readonly editorResource: string;
  readonly issues: SettingsEditorIssue[];
};

export type SettingsEditorServiceOptions = {
  settingsService: SettingsService;
  shell?: WorkbenchShell;
};

type Listener = (snapshot: SettingsEditorSnapshot) => void;

const CATEGORY_LABELS: Record<string, string> = {
  workbench: 'Workbench',
  window: 'Window',
  files: 'Files',
  editor: 'Editor',
  terminal: 'Terminal'
};

const JSON_SOURCE_PREFIX = 'settings-editor:json:';

export class SettingsEditorService {
  private readonly settingsService: SettingsService;
  private readonly shell?: WorkbenchShell;
  private readonly listeners = new Set<Listener>();
  private readonly jsonDrafts: Record<SettingsScope, string> = {
    user: '{}',
    workspace: '{}'
  };
  private readonly issuesByScope: Record<SettingsScope, SettingsEditorIssue[]> = {
    user: [],
    workspace: []
  };
  private activeScope: SettingsScope = 'user';
  private activeMode: SettingsEditorMode = 'form';
  private query = '';
  private focusedKey?: string;

  constructor(options: SettingsEditorServiceOptions) {
    this.settingsService = options.settingsService;
    this.shell = options.shell;
    this.refreshDraft('user');
    this.refreshDraft('workspace');
    this.settingsService.onDidChange(event => {
      this.handleSettingsChange(event);
    });
  }

  open(options: {
    scope?: SettingsScope;
    mode?: SettingsEditorMode;
    query?: string;
    focusKey?: string;
  } = {}) {
    if (options.scope) {
      this.ensureScopeSupported(options.scope);
      this.activeScope = options.scope;
    }
    if (options.mode) {
      this.activeMode = options.mode;
    }
    if (options.query !== undefined) {
      this.query = options.query.trim();
    }
    if (options.focusKey !== undefined) {
      this.focusedKey = options.focusKey;
    }
    const snapshot = this.snapshot();
    this.shell?.openEditor({
      title: buildEditorTitle(snapshot.activeScope, snapshot.activeMode),
      resource: snapshot.editorResource,
      kind: 'text'
    });
    this.emit(snapshot);
    return snapshot;
  }

  setQuery(query: string) {
    this.query = query.trim();
    const snapshot = this.snapshot();
    this.emit(snapshot);
    return snapshot;
  }

  updateSetting(key: string, value: unknown, scope = this.activeScope) {
    this.ensureScopeSupported(scope);
    this.settingsService.updateSetting(scope, key, value);
    this.focusedKey = key;
    this.issuesByScope[scope] = [];
    if (scope !== 'user') {
      this.activeScope = scope;
    }
    const next = this.snapshotFromSettingsSnapshot();
    this.emit(next);
    return next;
  }

  resetSetting(key: string, scope = this.activeScope) {
    this.ensureScopeSupported(scope);
    this.settingsService.removeSetting(scope, key);
    this.focusedKey = key;
    this.issuesByScope[scope] = [];
    const next = this.snapshotFromSettingsSnapshot();
    this.emit(next);
    return next;
  }

  updateJsonText(text: string, scope = this.activeScope) {
    this.ensureScopeSupported(scope);
    this.activeScope = scope;
    this.activeMode = 'json';
    this.jsonDrafts[scope] = text;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      this.issuesByScope[scope] = [
        {
          scope,
          source: 'json',
          message: `Invalid JSON: ${(error as Error).message}`
        }
      ];
      const snapshot = this.snapshot();
      this.emit(snapshot);
      return snapshot;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      this.issuesByScope[scope] = [
        {
          scope,
          source: 'json',
          message: 'Settings JSON root value must be an object'
        }
      ];
      const snapshot = this.snapshot();
      this.emit(snapshot);
      return snapshot;
    }

    this.issuesByScope[scope] = [];
    this.settingsService.updateSettings(scope, parsed as Record<string, unknown>, {
      replace: true,
      source: `${JSON_SOURCE_PREFIX}${scope}`
    });
    const next = this.snapshotFromSettingsSnapshot();
    this.emit(next);
    return next;
  }

  getSnapshot() {
    return this.snapshot();
  }

  querySections(scope: SettingsScope, query: string) {
    this.ensureScopeSupported(scope);
    return buildSections(this.settingsService, scope, query);
  }

  onDidChange(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private handleSettingsChange(event: SettingsChangeEvent) {
    if (event.source !== `${JSON_SOURCE_PREFIX}${event.scope}`) {
      this.refreshDraft(event.scope);
    }
    const snapshot = this.snapshot();
    this.emit(snapshot);
  }

  private emit(snapshot: SettingsEditorSnapshot) {
    if (!this.listeners.size) {
      return;
    }
    this.listeners.forEach(listener => listener(snapshot));
  }

  private refreshDraft(scope: SettingsScope) {
    this.jsonDrafts[scope] = serializeSettingsObject(this.settingsService.getScopeValues(scope));
    this.issuesByScope[scope] = [];
  }

  private snapshot(): SettingsEditorSnapshot {
    const availableScopes: SettingsScope[] = this.settingsService.supportsScope('workspace')
      ? ['user', 'workspace']
      : ['user'];
    return {
      activeScope: this.activeScope,
      activeMode: this.activeMode,
      query: this.query,
      focusedKey: this.focusedKey,
      availableScopes,
      sections: this.querySections(this.activeScope, this.query),
      jsonText: this.jsonDrafts[this.activeScope],
      jsonUri: buildJsonUri(this.activeScope),
      editorResource: buildEditorResource(this.activeScope, this.activeMode),
      issues: [...this.issuesByScope[this.activeScope]]
    };
  }

  private snapshotFromSettingsSnapshot() {
    this.refreshDraft('user');
    this.refreshDraft('workspace');
    return this.snapshot();
  }

  private ensureScopeSupported(scope: SettingsScope) {
    if (!this.settingsService.supportsScope(scope)) {
      throw new Error(`Settings scope "${scope}" is not available in the current workspace`);
    }
  }
}

function buildSections(settingsService: SettingsService, scope: SettingsScope, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const sections = new Map<string, SettingsEditorEntry[]>();

  settingsService.listDefinitions().forEach(definition => {
    if (!supportsDefinitionScope(definition.scope, scope)) {
      return;
    }

    const inspection = settingsService.inspect(definition.key);
    const entry = toEditorEntry(inspection);
    if (!matchesQuery(entry, normalizedQuery)) {
      return;
    }

    const bucket = sections.get(entry.category) ?? [];
    bucket.push(entry);
    sections.set(entry.category, bucket);
  });

  return [...sections.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, entries]) => ({
      id: category.toLowerCase(),
      title: category,
      entries: entries.sort((left, right) => left.key.localeCompare(right.key))
    }));
}

function supportsDefinitionScope(
  scope: SettingInspection['definition']['scope'],
  activeScope: SettingsScope
) {
  return !scope || scope === 'both' || scope === activeScope;
}

function toEditorEntry(inspection: SettingInspection): SettingsEditorEntry {
  const categoryKey = inspection.key.split('.')[0] ?? 'General';
  return {
    key: inspection.key,
    title: humanizeSettingKey(inspection.key),
    category: CATEGORY_LABELS[categoryKey] ?? humanizeSegment(categoryKey),
    description: inspection.definition.description,
    type: inspection.definition.type,
    scope: inspection.definition.scope,
    value: inspection.value,
    defaultValue: inspection.defaultValue,
    userValue: inspection.userValue,
    workspaceValue: inspection.workspaceValue,
    enum: inspection.definition.enum,
    minimum: inspection.definition.minimum,
    maximum: inspection.definition.maximum
  };
}

function matchesQuery(entry: SettingsEditorEntry, query: string) {
  if (!query) {
    return true;
  }
  const haystack = [entry.key, entry.title, entry.description, entry.category]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function humanizeSettingKey(key: string) {
  const parts = key.split('.');
  const leaf = parts[parts.length - 1] ?? key;
  return humanizeSegment(leaf);
}

function humanizeSegment(segment: string) {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function serializeSettingsObject(values: Record<string, unknown>) {
  return `${JSON.stringify(sortObject(values), null, 2)}\n`;
}

function sortObject(values: Record<string, unknown>) {
  return Object.keys(values)
    .sort((left, right) => left.localeCompare(right))
    .reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = values[key];
      return sorted;
    }, {});
}

function buildJsonUri(scope: SettingsScope) {
  return `settings://${scope}/settings.json`;
}

function buildEditorResource(scope: SettingsScope, mode: SettingsEditorMode) {
  return `settings://${scope}/${mode}`;
}

function buildEditorTitle(scope: SettingsScope, mode: SettingsEditorMode) {
  const scopeTitle = scope === 'user' ? 'User' : 'Workspace';
  const modeTitle = mode === 'json' ? 'JSON' : 'Settings';
  return `${scopeTitle} ${modeTitle}`;
}
