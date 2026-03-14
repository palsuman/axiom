import { CommandRegistry } from '../command-registry';
import type { MonacoEditorInstance } from './monaco-types';

export type EditorCapabilityTelemetry =
  | { type: 'command'; command: string }
  | { type: 'toggle'; capability: keyof CapabilityState; value: boolean };

type CapabilityState = {
  minimap: boolean;
  folding: boolean;
  bracketMatching: boolean;
};

type BridgeOptions = {
  telemetry?: (event: EditorCapabilityTelemetry) => void;
};

const DEFAULT_STATE: CapabilityState = {
  minimap: true,
  folding: true,
  bracketMatching: true
};

export class EditorCapabilityBridge {
  private activeEditor?: MonacoEditorInstance;
  private readonly state: CapabilityState = { ...DEFAULT_STATE };

  constructor(private readonly options: BridgeOptions = {}) {}

  registerDefaultCommands(registry: CommandRegistry) {
    registry.register({
      id: 'nexus.editor.undo',
      title: 'Undo',
      category: 'Edit',
      keybinding: { mac: 'Cmd+Z', win: 'Ctrl+Z' },
      handler: () => this.undo()
    });
    registry.register({
      id: 'nexus.editor.redo',
      title: 'Redo',
      category: 'Edit',
      keybinding: { mac: 'Cmd+Shift+Z', win: 'Ctrl+Y' },
      handler: () => this.redo()
    });
    registry.register({
      id: 'nexus.editor.toggleMinimap',
      title: 'Toggle Minimap',
      category: 'View',
      handler: () => this.toggleMinimap()
    });
    registry.register({
      id: 'nexus.editor.toggleFolding',
      title: 'Toggle Code Folding',
      category: 'View',
      handler: () => this.toggleFolding()
    });
    registry.register({
      id: 'nexus.editor.toggleBracketMatching',
      title: 'Toggle Bracket Matching',
      category: 'View',
      handler: () => this.toggleBracketMatching()
    });
    registry.register({
      id: 'nexus.editor.addCursorAbove',
      title: 'Add Cursor Above',
      category: 'Selection',
      keybinding: { mac: 'Option+Cmd+Up', win: 'Alt+Ctrl+Up' },
      handler: () => this.addCursorAbove()
    });
    registry.register({
      id: 'nexus.editor.addCursorBelow',
      title: 'Add Cursor Below',
      category: 'Selection',
      keybinding: { mac: 'Option+Cmd+Down', win: 'Alt+Ctrl+Down' },
      handler: () => this.addCursorBelow()
    });
  }

  setActiveEditor(editor: MonacoEditorInstance | null) {
    this.activeEditor = editor ?? undefined;
    if (this.activeEditor) {
      this.applyCapabilities(this.activeEditor);
    }
  }

  getCapabilitySnapshot(): CapabilityState {
    return { ...this.state };
  }

  undo() {
    return this.executeEditorCommand('undo');
  }

  redo() {
    return this.executeEditorCommand('redo');
  }

  addCursorAbove() {
    return this.executeEditorCommand('editor.action.insertCursorAbove');
  }

  addCursorBelow() {
    return this.executeEditorCommand('editor.action.insertCursorBelow');
  }

  toggleMinimap(force?: boolean) {
    const next = typeof force === 'boolean' ? force : !this.state.minimap;
    this.state.minimap = next;
    this.emit({ type: 'toggle', capability: 'minimap', value: next });
    this.applyCapabilities();
    return next;
  }

  toggleFolding(force?: boolean) {
    const next = typeof force === 'boolean' ? force : !this.state.folding;
    this.state.folding = next;
    this.emit({ type: 'toggle', capability: 'folding', value: next });
    this.applyCapabilities();
    return next;
  }

  toggleBracketMatching(force?: boolean) {
    const next = typeof force === 'boolean' ? force : !this.state.bracketMatching;
    this.state.bracketMatching = next;
    this.emit({ type: 'toggle', capability: 'bracketMatching', value: next });
    this.applyCapabilities();
    return next;
  }

  private applyCapabilities(target: MonacoEditorInstance | undefined = this.activeEditor) {
    if (!target) return;
    target.updateOptions({
      minimap: { enabled: this.state.minimap },
      folding: this.state.folding,
      matchBrackets: this.state.bracketMatching ? 'always' : 'never'
    });
  }

  private executeEditorCommand(handlerId: string) {
    if (!this.activeEditor) {
      return false;
    }
    this.activeEditor.trigger('nexus', handlerId, undefined);
    this.emit({ type: 'command', command: handlerId });
    return true;
  }

  private emit(event: EditorCapabilityTelemetry) {
    if (this.options.telemetry) {
      this.options.telemetry(event);
    }
  }
}
