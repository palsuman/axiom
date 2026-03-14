import type { MonacoApi, MonacoEditorInstance, MonacoModel } from './monaco-types';
import { MonacoLoader, type MonacoLoaderOptions } from './monaco-loader';

export type EditorUri = string;

export interface MonacoEditorInit {
  container: HTMLElement;
  uri: EditorUri;
  value: string;
  language: string;
  readOnly?: boolean;
  tabSize?: number;
}

export interface WorkbenchThemeDefinition {
  base: 'vs' | 'vs-dark' | 'hc-black';
  inherit?: boolean;
  foreground: string;
  background: string;
  selection?: string;
  lineHighlight?: string;
  comments?: string;
}

type ModelEntry = {
  model: MonacoModel;
  refCount: number;
};

type ThemeState = {
  id: string;
  definition: {
    base: 'vs' | 'vs-dark' | 'hc-black';
    inherit: boolean;
    colors: Record<string, string>;
    rules: Array<{ token: string; foreground?: string }>;
  };
};

export class MonacoEditorService {
  private readonly loader: MonacoLoader;
  private readonly editors = new Set<MonacoEditorInstance>();
  private readonly models = new Map<string, ModelEntry>();
  private pendingTheme?: ThemeState;
  private activeTheme?: string;

  constructor(options: MonacoLoaderOptions = {}, loader?: MonacoLoader) {
    this.loader = loader ?? new MonacoLoader(options);
  }

  async createEditor(init: MonacoEditorInit): Promise<MonacoEditorInstance> {
    if (!init.container) {
      throw new Error('Editor container is required');
    }
    const monaco = await this.getMonaco();
    const modelEntry = this.resolveModel(monaco, init);
    const editor = monaco.editor.create(init.container, {
      model: modelEntry.model,
      readOnly: init.readOnly ?? false,
      minimap: { enabled: false },
      automaticLayout: true,
      tabSize: init.tabSize ?? 2,
      theme: this.activeTheme
    });
    this.editors.add(editor);
    return editor;
  }

  async updateModelContent(uri: EditorUri, value: string) {
    const entry = this.models.get(uri);
    if (!entry) {
      throw new Error(`Model not found for ${uri}`);
    }
    entry.model.setValue(value);
  }

  async disposeEditor(editor: MonacoEditorInstance) {
    if (!this.editors.delete(editor)) {
      return;
    }
    const model = editor.getModel();
    editor.dispose();
    if (model) {
      this.releaseModel(model);
    }
  }

  async disposeAll() {
    for (const editor of Array.from(this.editors.values())) {
      await this.disposeEditor(editor);
    }
    for (const entry of this.models.values()) {
      entry.model.dispose();
    }
    this.models.clear();
  }

  async updateWorkbenchTheme(themeId: string, theme: WorkbenchThemeDefinition) {
    const normalized: ThemeState = {
      id: themeId,
      definition: {
        base: theme.base,
        inherit: theme.inherit ?? true,
        colors: {
          'editor.foreground': theme.foreground,
          'editor.background': theme.background,
          'editor.selectionBackground': theme.selection ?? '#264F78',
          'editor.lineHighlightBackground': theme.lineHighlight ?? '#2b2b2b50',
          'editorLineNumber.foreground': theme.foreground,
          'editorCursor.foreground': theme.foreground
        },
        rules: [
          {
            token: 'comment',
            foreground: (theme.comments ?? theme.foreground).replace('#', '')
          }
        ]
      }
    };
    if (!this.loader.isLoaded()) {
      this.pendingTheme = normalized;
      this.activeTheme = normalized.id;
      return;
    }
    const monaco = await this.getMonaco();
    this.applyTheme(monaco, normalized);
  }

  private async getMonaco() {
    const monaco = await this.loader.load();
    if (this.pendingTheme) {
      this.applyTheme(monaco, this.pendingTheme);
      this.pendingTheme = undefined;
    }
    return monaco;
  }

  private resolveModel(monaco: MonacoApi, init: MonacoEditorInit): ModelEntry {
    const uri = monaco.Uri.parse(init.uri);
    const key = uri.toString();
    let entry = this.models.get(key);
    if (!entry) {
      const model = monaco.editor.createModel(init.value, init.language, uri);
      entry = { model, refCount: 0 };
      this.models.set(key, entry);
    }
    entry.refCount += 1;
    return entry;
  }

  private releaseModel(model: MonacoModel) {
    const key = model.uri.toString();
    const entry = this.models.get(key);
    if (!entry) return;
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      entry.model.dispose();
      this.models.delete(key);
    }
  }

  private applyTheme(monaco: MonacoApi, theme: ThemeState) {
    monaco.editor.defineTheme(theme.id, theme.definition);
    monaco.editor.setTheme(theme.id);
    this.activeTheme = theme.id;
  }
}
