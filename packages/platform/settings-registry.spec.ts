import { SettingsRegistry, type SettingDefinition } from './settings-registry';

describe('SettingsRegistry', () => {
  const baseDefinitions: SettingDefinition[] = [
    {
      key: 'workbench.colorTheme',
      type: 'string',
      description: 'Controls the workbench theme.',
      defaultValue: 'Nexus Dark',
      enum: ['Nexus Dark', 'Nexus Light'],
      scope: 'user'
    },
    {
      key: 'files.autoSaveDelay',
      type: 'integer',
      description: 'Delay before autosave runs.',
      defaultValue: 1000,
      minimum: 50,
      maximum: 60000
    },
    {
      key: 'files.exclude',
      type: 'object',
      description: 'Glob map for excluded files.',
      defaultValue: {}
    }
  ];

  function createRegistry() {
    const registry = new SettingsRegistry();
    registry.registerMany(baseDefinitions);
    return registry;
  }

  it('resolves defaults, user settings, and workspace overrides in order', () => {
    const registry = createRegistry();

    expect(registry.get('files.autoSaveDelay')).toBe(1000);

    registry.applyValues('user', { 'files.autoSaveDelay': 1200 });
    expect(registry.get('files.autoSaveDelay')).toBe(1200);

    registry.applyValues('workspace', { 'files.autoSaveDelay': 450 });
    expect(registry.get('files.autoSaveDelay')).toBe(450);

    registry.removeValue('workspace', 'files.autoSaveDelay');
    expect(registry.get('files.autoSaveDelay')).toBe(1200);
  });

  it('rejects invalid values, unknown settings, and unsupported scopes', () => {
    const registry = createRegistry();

    const invalid = registry.applyValues(
      'workspace',
      {
        'workbench.colorTheme': 'Nexus Light',
        'files.autoSaveDelay': 25,
        'unknown.setting': true
      },
      { source: 'workspace.json' }
    );

    expect(invalid.changedKeys).toEqual([]);
    expect(invalid.issues).toEqual([
      {
        key: 'workbench.colorTheme',
        scope: 'workspace',
        message: 'Setting "workbench.colorTheme" does not support workspace overrides',
        source: 'workspace.json'
      },
      {
        key: 'files.autoSaveDelay',
        scope: 'workspace',
        message: 'Invalid value for "files.autoSaveDelay": must be >= 50',
        source: 'workspace.json'
      },
      {
        key: 'unknown.setting',
        scope: 'workspace',
        message: 'Unknown setting "unknown.setting"',
        source: 'workspace.json'
      }
    ]);
  });

  it('exports a schema document and inspection data', () => {
    const registry = createRegistry();
    registry.applyValues('user', {
      'files.exclude': {
        '**/dist': true
      }
    });

    const inspection = registry.inspect<Record<string, boolean>>('files.exclude');
    expect(inspection.defaultValue).toEqual({});
    expect(inspection.userValue).toEqual({ '**/dist': true });
    expect(inspection.value).toEqual({ '**/dist': true });

    const schema = registry.toJSONSchema();
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties['files.autoSaveDelay']).toMatchObject({
      type: 'integer',
      default: 1000,
      minimum: 50,
      maximum: 60000,
      scope: 'both'
    });
  });

  it('emits change events only when the resolved value changes', () => {
    const registry = createRegistry();
    const events: Array<{ key: string; previousValue: unknown; value: unknown }> = [];

    registry.onDidChange(event => {
      events.push({
        key: event.key,
        previousValue: event.previousValue,
        value: event.value
      });
    });

    registry.applyValues('user', { 'files.autoSaveDelay': 2000 });
    registry.applyValues('user', { 'files.autoSaveDelay': 2000 });
    registry.applyValues('workspace', { 'files.autoSaveDelay': 3000 });
    registry.applyValues('user', { 'files.autoSaveDelay': 1500 });

    expect(events).toEqual([
      {
        key: 'files.autoSaveDelay',
        previousValue: 1000,
        value: 2000
      },
      {
        key: 'files.autoSaveDelay',
        previousValue: 2000,
        value: 3000
      }
    ]);
  });

  it('rejects duplicate registrations and invalid defaults', () => {
    const registry = new SettingsRegistry();
    registry.register(baseDefinitions[0]!);

    expect(() => registry.register(baseDefinitions[0]!)).toThrow(/already registered/);
    expect(() =>
      registry.register({
        key: 'editor.tabSize',
        type: 'integer',
        description: 'Tab size.',
        defaultValue: 0,
        minimum: 1
      })
    ).toThrow(/must be >= 1/);
  });
});
