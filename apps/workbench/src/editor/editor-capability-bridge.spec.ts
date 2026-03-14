import { CommandRegistry } from '../commands/command-registry';
import { EditorCapabilityBridge } from './editor-capability-bridge';
import type { MonacoEditorInstance } from './monaco-types';

function createEditorStub() {
  const editor: jest.Mocked<MonacoEditorInstance> = {
    getId: jest.fn(() => 'editor-1'),
    getModel: jest.fn(() => null),
    updateOptions: jest.fn(),
    dispose: jest.fn(),
    trigger: jest.fn(),
    setSelections: jest.fn(),
    focus: jest.fn()
  };
  return editor;
}

describe('EditorCapabilityBridge', () => {
  it('applies capability toggles to the active editor', () => {
    const events: string[] = [];
    const bridge = new EditorCapabilityBridge({
      telemetry: event => events.push(JSON.stringify(event))
    });
    const editor = createEditorStub();

    bridge.setActiveEditor(editor);
    bridge.toggleMinimap(false);
    bridge.toggleFolding(false);
    bridge.toggleBracketMatching(false);

    expect(editor.updateOptions).toHaveBeenLastCalledWith({
      minimap: { enabled: false },
      folding: false,
      matchBrackets: 'never'
    });
    expect(events).toContainEqual(JSON.stringify({ type: 'toggle', capability: 'minimap', value: false }));
    expect(events).toContainEqual(JSON.stringify({ type: 'toggle', capability: 'folding', value: false }));
    expect(events).toContainEqual(JSON.stringify({ type: 'toggle', capability: 'bracketMatching', value: false }));
    expect(bridge.getCapabilitySnapshot()).toEqual({
      minimap: false,
      folding: false,
      bracketMatching: false
    });
  });

  it('deferred toggles apply when a new editor becomes active', () => {
    const bridge = new EditorCapabilityBridge();
    bridge.toggleMinimap(false);
    const editor = createEditorStub();
    bridge.setActiveEditor(editor);
    expect(editor.updateOptions).toHaveBeenLastCalledWith({
      minimap: { enabled: false },
      folding: true,
      matchBrackets: 'always'
    });
  });

  it('registers commands that route to editor capabilities', async () => {
    const bridge = new EditorCapabilityBridge();
    const registry = new CommandRegistry();
    bridge.registerDefaultCommands(registry);
    const editor = createEditorStub();
    bridge.setActiveEditor(editor);

    await registry.executeCommand('nexus.editor.undo');
    await registry.executeCommand('nexus.editor.redo');
    await registry.executeCommand('nexus.editor.addCursorAbove');
    await registry.executeCommand('nexus.editor.addCursorBelow');

    expect(editor.trigger).toHaveBeenNthCalledWith(1, 'nexus', 'undo', undefined);
    expect(editor.trigger).toHaveBeenNthCalledWith(2, 'nexus', 'redo', undefined);
    expect(editor.trigger).toHaveBeenNthCalledWith(3, 'nexus', 'editor.action.insertCursorAbove', undefined);
    expect(editor.trigger).toHaveBeenNthCalledWith(4, 'nexus', 'editor.action.insertCursorBelow', undefined);
  });
});
