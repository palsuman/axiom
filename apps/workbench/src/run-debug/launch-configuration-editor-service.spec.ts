import { createDefaultLayoutState, WorkbenchShell } from '../shell/workbench-shell';
import { LaunchConfigurationEditorService } from './launch-configuration-editor-service';

describe('LaunchConfigurationEditorService', () => {
  function createBridge() {
    return {
      runConfigLoad: jest.fn().mockResolvedValue({
        path: '/workspace/.nexus/launch.json',
        exists: true,
        text: JSON.stringify(
          {
            version: '1.0.0',
            configurations: [
              {
                name: 'Launch API',
                type: 'node',
                request: 'launch',
                program: '${workspaceFolder}/server.js'
              }
            ]
          },
          null,
          2
        ),
        issues: []
      }),
      runConfigSave: jest.fn().mockImplementation(async (text: string) => ({
        path: '/workspace/.nexus/launch.json',
        saved: true,
        text,
        issues: []
      }))
    };
  }

  it('opens launch configurations in the editor area and loads persisted JSON', async () => {
    const shell = new WorkbenchShell(createDefaultLayoutState());
    const bridge = createBridge();
    const service = new LaunchConfigurationEditorService({ shell, bridge });

    const snapshot = await service.open({ mode: 'form' });

    expect(snapshot.editorResource).toBe('run-config://form');
    expect(snapshot.path).toBe('/workspace/.nexus/launch.json');
    expect(snapshot.configurations[0]?.name).toBe('Launch API');
    expect(shell.layoutSnapshot().editors.groups[0]?.tabs[0]?.resource).toBe('run-config://form');
  });

  it('adds and updates configurations through the form editor', async () => {
    const bridge = createBridge();
    const service = new LaunchConfigurationEditorService({ bridge });

    await service.open({ mode: 'form' });
    await service.addConfiguration();
    const updated = await service.updateConfigurationField(1, 'argsText', '--watch, --inspect');

    expect(updated.configurations).toHaveLength(2);
    expect(updated.configurations[1]?.args).toEqual(['--watch', '--inspect']);
    expect(bridge.runConfigSave).toHaveBeenCalled();
  });

  it('retains JSON validation issues until the user applies a valid document', async () => {
    const bridge = createBridge();
    const service = new LaunchConfigurationEditorService({ bridge });

    await service.open({ mode: 'json' });
    const invalidSnapshot = service.updateJsonText('{');
    expect(invalidSnapshot.issues[0]?.path).toBe('$');

    service.updateJsonText(
      JSON.stringify(
        {
          version: '1.0.0',
          configurations: []
        },
        null,
        2
      )
    );
    const validSnapshot = await service.applyJsonText();
    expect(validSnapshot.issues).toEqual([]);
    expect(validSnapshot.jsonText).toContain('"configurations": []');
  });
});
