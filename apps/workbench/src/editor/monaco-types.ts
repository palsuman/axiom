export interface MonacoUri {
  toString(): string;
}

export interface MonacoModel {
  uri: MonacoUri;
  getValue(): string;
  setValue(value: string): void;
  updateOptions(options: Record<string, unknown>): void;
  dispose(): void;
  onDidChangeContent(listener: () => void): Disposable;
}

export interface MonacoEditorInstance {
  getId(): string;
  getModel(): MonacoModel | null;
  updateOptions(options: Record<string, unknown>): void;
  dispose(): void;
  trigger(source: string, handlerId: string, payload?: unknown): void;
  setSelections?(selections: MonacoSelection[]): void;
  focus?(): void;
}

export interface MonacoThemeDefinition {
  base: 'vs' | 'vs-dark' | 'hc-black';
  inherit: boolean;
  colors: Record<string, string>;
  rules: Array<{ token: string; foreground?: string; fontStyle?: string }>;
}

export interface MonacoEditorNamespace {
  create(container: HTMLElement, options: Record<string, unknown>): MonacoEditorInstance;
  createModel(value: string, language: string, uri: MonacoUri): MonacoModel;
  getModel(uri: MonacoUri): MonacoModel | null;
  defineTheme(name: string, theme: MonacoThemeDefinition): void;
  setTheme(name: string): void;
}

export interface MonacoApi {
  editor: MonacoEditorNamespace;
  Uri: { parse(target: string): MonacoUri };
}

export interface Disposable {
  dispose(): void;
}

export type AMDRequire = {
  (modules: string[], onLoad: (...modules: any[]) => void, onError?: (error: Error) => void): void;
  config?: (options: { paths: Record<string, string> }) => void;
};

export type MonacoEnvironment = {
  getWorkerUrl?(moduleId: string, label: string): string;
};

export interface MonacoSelection {
  selectionStartLineNumber: number;
  selectionStartColumn: number;
  positionLineNumber: number;
  positionColumn: number;
}
