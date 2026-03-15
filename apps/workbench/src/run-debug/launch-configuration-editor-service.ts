import type {
  RunConfigurationLoadResponse,
  RunConfigurationSaveResponse
} from '@nexus/contracts/ipc';
import {
  createDefaultLaunchConfiguration,
  createDefaultLaunchConfigurationDocument,
  parseLaunchConfigurationDocument,
  serializeLaunchConfigurationDocument,
  type LaunchConfiguration,
  type LaunchConfigurationDocument,
  type LaunchConfigurationIssue
} from '@nexus/platform/run-debug/launch-config';
import { resolveNexusBridge } from '../boot/nexus-bridge-resolver';
import type { WorkbenchShell } from '../shell/workbench-shell';

type LaunchConfigurationBridge = {
  runConfigLoad(): Promise<RunConfigurationLoadResponse>;
  runConfigSave(text: string): Promise<RunConfigurationSaveResponse>;
} | undefined;

type LaunchConfigurationHydrateResponse = {
  path?: string;
  exists: boolean;
  text: string;
  issues: readonly LaunchConfigurationIssue[];
};

export type LaunchConfigurationEditorMode = 'form' | 'json';

export type LaunchConfigurationTemplate = 'node-launch' | 'node-attach';

export type LaunchConfigurationEditorSnapshot = {
  readonly mode: LaunchConfigurationEditorMode;
  readonly editorResource: string;
  readonly path?: string;
  readonly exists: boolean;
  readonly configurations: readonly LaunchConfiguration[];
  readonly jsonText: string;
  readonly issues: readonly LaunchConfigurationIssue[];
  readonly schemaUri: string;
};

type Listener = (snapshot: LaunchConfigurationEditorSnapshot) => void;

export class LaunchConfigurationEditorService {
  private readonly shell?: WorkbenchShell;
  private readonly bridge: LaunchConfigurationBridge;
  private readonly listeners = new Set<Listener>();
  private document: LaunchConfigurationDocument = createDefaultLaunchConfigurationDocument({ configurations: [] });
  private mode: LaunchConfigurationEditorMode = 'form';
  private jsonText = serializeLaunchConfigurationDocument(this.document);
  private issues: LaunchConfigurationIssue[] = [];
  private path?: string;
  private exists = false;
  private loaded = false;

  constructor(options: { shell?: WorkbenchShell; bridge?: LaunchConfigurationBridge } = {}) {
    this.shell = options.shell;
    this.bridge = options.bridge ?? LaunchConfigurationEditorService.resolveBridge();
  }

  async open(options: { mode?: LaunchConfigurationEditorMode } = {}) {
    if (options.mode) {
      this.mode = options.mode;
    }
    if (!this.loaded) {
      await this.refresh();
    }
    const snapshot = this.snapshot();
    this.shell?.openEditor({
      title: this.mode === 'form' ? 'Launch Configurations' : 'launch.json',
      resource: snapshot.editorResource,
      kind: 'text'
    });
    this.emit(snapshot);
    return snapshot;
  }

  async refresh() {
    if (!this.bridge) {
      this.hydrate({
        path: undefined,
        exists: false,
        text: serializeLaunchConfigurationDocument(createDefaultLaunchConfigurationDocument({ configurations: [] })),
        issues: []
      });
      const snapshot = this.snapshot();
      this.emit(snapshot);
      return snapshot;
    }
    const response = await this.bridge.runConfigLoad();
    this.hydrate(response);
    const snapshot = this.snapshot();
    this.emit(snapshot);
    return snapshot;
  }

  async setMode(mode: LaunchConfigurationEditorMode) {
    this.mode = mode;
    return this.open({ mode });
  }

  async addConfiguration(template: LaunchConfigurationTemplate = 'node-launch') {
    const configuration =
      template === 'node-attach'
        ? createDefaultLaunchConfiguration({
            name: 'Attach Process',
            request: 'attach',
            program: undefined
          })
        : createDefaultLaunchConfiguration();
    const document: LaunchConfigurationDocument = {
      ...this.document,
      configurations: [...this.document.configurations, configuration]
    };
    return this.persistDocument(document);
  }

  async removeConfiguration(index: number) {
    const document: LaunchConfigurationDocument = {
      ...this.document,
      configurations: this.document.configurations.filter((_, candidateIndex) => candidateIndex !== index)
    };
    return this.persistDocument(document);
  }

  async updateConfigurationField(index: number, field: string, rawValue: unknown) {
    const existing = this.document.configurations[index];
    if (!existing) {
      throw new Error(`Launch configuration at index ${index} does not exist`);
    }
    const updated = {
      ...existing,
      ...readFieldUpdate(field, rawValue)
    };
    const configurations = this.document.configurations.map((configuration, candidateIndex) =>
      candidateIndex === index ? updated : configuration
    );
    return this.persistDocument({
      ...this.document,
      configurations
    });
  }

  updateJsonText(text: string) {
    this.mode = 'json';
    this.jsonText = text;
    this.issues = [...parseLaunchConfigurationDocument(text).issues];
    const snapshot = this.snapshot();
    this.emit(snapshot);
    return snapshot;
  }

  async applyJsonText() {
    if (this.issues.length) {
      return this.snapshot();
    }
    if (!this.bridge) {
      this.hydrate({
        exists: true,
        path: this.path,
        text: this.jsonText,
        issues: []
      });
      const snapshot = this.snapshot();
      this.emit(snapshot);
      return snapshot;
    }
    const response = await this.bridge.runConfigSave(this.jsonText);
    this.hydrate(this.normalizeSaveResponse(response));
    const snapshot = this.snapshot();
    this.emit(snapshot);
    return snapshot;
  }

  getSnapshot() {
    return this.snapshot();
  }

  onDidChange(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async persistDocument(document: LaunchConfigurationDocument) {
    const text = serializeLaunchConfigurationDocument(document);
    this.jsonText = text;
    this.issues = [];
    this.mode = 'form';
    if (!this.bridge) {
      this.hydrate({
        path: this.path,
        exists: true,
        text,
        issues: []
      });
      const snapshot = this.snapshot();
      this.emit(snapshot);
      return snapshot;
    }
    const response = await this.bridge.runConfigSave(text);
    this.hydrate(this.normalizeSaveResponse(response));
    const snapshot = this.snapshot();
    this.emit(snapshot);
    return snapshot;
  }

  private hydrate(response: LaunchConfigurationHydrateResponse) {
    const parsed = parseLaunchConfigurationDocument(response.text);
    this.path = response.path;
    this.exists = response.exists;
    this.document = parsed.document;
    this.jsonText = response.text;
    this.issues = [...response.issues];
    this.loaded = true;
  }

  private snapshot(): LaunchConfigurationEditorSnapshot {
    return {
      mode: this.mode,
      editorResource: buildEditorResource(this.mode),
      path: this.path,
      exists: this.exists,
      configurations: this.document.configurations,
      jsonText: this.jsonText,
      issues: [...this.issues],
      schemaUri: 'https://schema.nexus.dev/run-debug/launch-configuration.schema.json'
    };
  }

  private emit(snapshot: LaunchConfigurationEditorSnapshot) {
    if (!this.listeners.size) {
      return;
    }
    this.listeners.forEach(listener => listener(snapshot));
  }

  private normalizeSaveResponse(response: RunConfigurationSaveResponse): LaunchConfigurationHydrateResponse {
    return {
      path: response.path,
      exists: response.saved || this.exists,
      text: response.text,
      issues: response.issues
    };
  }

  private static resolveBridge(): LaunchConfigurationBridge {
    const bridge = resolveNexusBridge<NonNullable<LaunchConfigurationBridge>>();
    if (bridge && typeof bridge.runConfigLoad === 'function' && typeof bridge.runConfigSave === 'function') {
      return bridge;
    }
    return undefined;
  }
}

function buildEditorResource(mode: LaunchConfigurationEditorMode) {
  return `run-config://${mode}`;
}

function readFieldUpdate(field: string, rawValue: unknown): Partial<LaunchConfiguration> {
  switch (field) {
    case 'name':
    case 'type':
      return { [field]: String(rawValue ?? '').trim() } as Partial<LaunchConfiguration>;
    case 'request':
      return { request: rawValue === 'attach' ? 'attach' : 'launch' };
    case 'program':
    case 'cwd':
    case 'preLaunchTask': {
      const value = String(rawValue ?? '').trim();
      return { [field]: value || undefined } as Partial<LaunchConfiguration>;
    }
    case 'console': {
      const value = String(rawValue ?? '').trim();
      return {
        console:
          value === 'internalConsole' || value === 'externalTerminal' ? value : 'integratedTerminal'
      };
    }
    case 'stopOnEntry':
      return { stopOnEntry: rawValue === true || rawValue === 'true' };
    case 'argsText':
      return { args: parseArgs(rawValue) };
    case 'envText':
      return { env: parseEnv(rawValue) };
    default:
      return {};
  }
}

function parseArgs(value: unknown) {
  return String(value ?? '')
    .split(/\r?\n|,/)
    .map(entry => entry.trim())
    .filter(Boolean);
}

function parseEnv(value: unknown) {
  const env: Record<string, string> = {};
  String(value ?? '')
    .split(/\r?\n/)
    .map(entry => entry.trim())
    .filter(Boolean)
    .forEach(entry => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex <= 0) {
        return;
      }
      const key = entry.slice(0, separatorIndex).trim();
      const envValue = entry.slice(separatorIndex + 1).trim();
      if (key) {
        env[key] = envValue;
      }
    });
  return env;
}
