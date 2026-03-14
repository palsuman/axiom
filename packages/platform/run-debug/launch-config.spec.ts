import {
  LAUNCH_CONFIGURATION_VERSION,
  createDefaultLaunchConfigurationDocument,
  createLaunchConfigurationSchemaDocument,
  parseLaunchConfigurationDocument,
  serializeLaunchConfigurationDocument,
  validateLaunchConfigurationDocument
} from './launch-config';

describe('launch configuration schema', () => {
  it('creates a normalized default document', () => {
    const document = createDefaultLaunchConfigurationDocument();

    expect(document.version).toBe(LAUNCH_CONFIGURATION_VERSION);
    expect(document.configurations).toEqual([
      expect.objectContaining({
        name: 'Launch Program',
        type: 'node',
        request: 'launch',
        console: 'integratedTerminal'
      })
    ]);
  });

  it('validates malformed documents with actionable issue paths', () => {
    const issues = validateLaunchConfigurationDocument({
      version: '',
      configurations: [
        {
          name: '',
          type: 'node',
          request: 'run',
          args: [1],
          env: { PORT: 3000 }
        }
      ]
    });

    expect(issues).toEqual([
      { path: '$.version', message: 'Version must be a non-empty string.' },
      { path: '$.configurations[0].name', message: 'name must be a non-empty string.' },
      { path: '$.configurations[0].request', message: 'request must be either "launch" or "attach".' },
      { path: '$.configurations[0].args', message: 'args must be an array of strings.' },
      { path: '$.configurations[0].env.PORT', message: 'Environment values must be strings.' }
    ]);
  });

  it('parses and normalizes valid JSON documents', () => {
    const result = parseLaunchConfigurationDocument(
      JSON.stringify(
        {
          version: '1.0.0',
          configurations: [
            {
              name: 'Attach Server',
              type: 'node',
              request: 'attach',
              cwd: ' /workspace ',
              args: ['--inspect'],
              env: { NODE_ENV: 'development' },
              console: 'internalConsole'
            }
          ]
        },
        null,
        2
      )
    );

    expect(result.issues).toEqual([]);
    expect(result.document.configurations[0]).toEqual({
      name: 'Attach Server',
      type: 'node',
      request: 'attach',
      cwd: '/workspace',
      args: ['--inspect'],
      env: { NODE_ENV: 'development' },
      console: 'internalConsole',
      stopOnEntry: false,
      program: undefined,
      preLaunchTask: undefined
    });
  });

  it('returns a default document plus issues when JSON is invalid', () => {
    const result = parseLaunchConfigurationDocument('{');

    expect(result.issues[0]?.path).toBe('$');
    expect(result.document.version).toBe(LAUNCH_CONFIGURATION_VERSION);
  });

  it('serializes documents with stable formatting and schema metadata', () => {
    const document = createDefaultLaunchConfigurationDocument({
      configurations: [
        {
          name: 'Launch API',
          type: 'node',
          request: 'launch',
          program: '${workspaceFolder}/server.js',
          cwd: '${workspaceFolder}',
          args: ['--port', '3000'],
          env: { NODE_ENV: 'development' },
          console: 'integratedTerminal',
          stopOnEntry: true
        }
      ]
    });

    expect(serializeLaunchConfigurationDocument(document)).toContain('"name": "Launch API"');
    expect(createLaunchConfigurationSchemaDocument()).toMatchObject({
      $id: expect.stringContaining('run-debug'),
      properties: {
        configurations: {
          items: {
            properties: {
              request: {
                enum: ['launch', 'attach']
              }
            }
          }
        }
      }
    });
  });
});
