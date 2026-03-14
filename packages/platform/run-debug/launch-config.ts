export const LAUNCH_CONFIGURATION_VERSION = '1.0.0';
export const LAUNCH_CONFIGURATION_SCHEMA_URI = 'https://schema.nexus.dev/run-debug/launch-configuration.schema.json';

export type LaunchRequest = 'launch' | 'attach';
export type LaunchConsole = 'integratedTerminal' | 'internalConsole' | 'externalTerminal';

export type LaunchConfiguration = {
  readonly name: string;
  readonly type: string;
  readonly request: LaunchRequest;
  readonly program?: string;
  readonly cwd?: string;
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly preLaunchTask?: string;
  readonly stopOnEntry?: boolean;
  readonly console?: LaunchConsole;
};

export type LaunchConfigurationDocument = {
  readonly version: string;
  readonly configurations: readonly LaunchConfiguration[];
};

export type LaunchConfigurationIssue = {
  readonly path: string;
  readonly message: string;
};

export type LaunchConfigurationSchemaProperty = {
  readonly type?: string | readonly string[];
  readonly description?: string;
  readonly default?: unknown;
  readonly enum?: readonly unknown[];
  readonly items?: LaunchConfigurationSchemaProperty;
  readonly properties?: Record<string, LaunchConfigurationSchemaProperty>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | LaunchConfigurationSchemaProperty;
  readonly minItems?: number;
};

export type LaunchConfigurationSchemaDocument = {
  readonly $schema: 'https://json-schema.org/draft/2020-12/schema';
  readonly $id: string;
  readonly type: 'object';
  readonly required: readonly ['version', 'configurations'];
  readonly additionalProperties: false;
  readonly properties: Record<string, LaunchConfigurationSchemaProperty>;
};

export type LaunchConfigurationParseResult = {
  readonly document: LaunchConfigurationDocument;
  readonly issues: readonly LaunchConfigurationIssue[];
};

const DEFAULT_CONFIGURATION: LaunchConfiguration = {
  name: 'Launch Program',
  type: 'node',
  request: 'launch',
  program: '${workspaceFolder}/index.js',
  cwd: '${workspaceFolder}',
  args: [],
  env: {},
  console: 'integratedTerminal',
  stopOnEntry: false
};

const VALID_REQUESTS = new Set<LaunchRequest>(['launch', 'attach']);
const VALID_CONSOLES = new Set<LaunchConsole>(['integratedTerminal', 'internalConsole', 'externalTerminal']);

export function createDefaultLaunchConfiguration(overrides: Partial<LaunchConfiguration> = {}): LaunchConfiguration {
  return normalizeConfiguration({ ...DEFAULT_CONFIGURATION, ...overrides });
}

export function createDefaultLaunchConfigurationDocument(
  overrides: Partial<LaunchConfigurationDocument> & { configuration?: Partial<LaunchConfiguration> } = {}
): LaunchConfigurationDocument {
  return {
    version: overrides.version ?? LAUNCH_CONFIGURATION_VERSION,
    configurations:
      overrides.configurations?.map(configuration => normalizeConfiguration(configuration)) ??
      [createDefaultLaunchConfiguration(overrides.configuration)]
  };
}

export function validateLaunchConfigurationDocument(document: unknown): LaunchConfigurationIssue[] {
  const issues: LaunchConfigurationIssue[] = [];
  if (!isPlainObject(document)) {
    return [{ path: '$', message: 'Launch configuration root must be an object.' }];
  }

  const version = document.version;
  if (typeof version !== 'string' || !version.trim()) {
    issues.push({ path: '$.version', message: 'Version must be a non-empty string.' });
  }

  if (!Array.isArray(document.configurations)) {
    issues.push({ path: '$.configurations', message: 'Configurations must be an array.' });
    return issues;
  }

  document.configurations.forEach((entry, index) => {
    issues.push(...validateLaunchConfiguration(entry, `$.configurations[${index}]`));
  });

  return issues;
}

export function parseLaunchConfigurationDocument(text: string): LaunchConfigurationParseResult {
  if (!text.trim()) {
    const document = createDefaultLaunchConfigurationDocument();
    return { document, issues: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      document: createDefaultLaunchConfigurationDocument(),
      issues: [{ path: '$', message: `Invalid JSON: ${(error as Error).message}` }]
    };
  }

  const issues = validateLaunchConfigurationDocument(parsed);
  if (issues.length) {
    return {
      document: createDefaultLaunchConfigurationDocument(),
      issues
    };
  }

  return {
    document: normalizeDocument(parsed as LaunchConfigurationDocument),
    issues: []
  };
}

export function serializeLaunchConfigurationDocument(document: LaunchConfigurationDocument) {
  return JSON.stringify(normalizeDocument(document), null, 2);
}

export function createLaunchConfigurationSchemaDocument(): LaunchConfigurationSchemaDocument {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: LAUNCH_CONFIGURATION_SCHEMA_URI,
    type: 'object',
    required: ['version', 'configurations'],
    additionalProperties: false,
    properties: {
      version: {
        type: 'string',
        description: 'Version of the Nexus launch configuration document.',
        default: LAUNCH_CONFIGURATION_VERSION
      },
      configurations: {
        type: 'array',
        description: 'Launch and attach configurations available in the current workspace.',
        minItems: 0,
        items: {
          type: 'object',
          required: ['name', 'type', 'request'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', description: 'Human-readable label shown in the Run & Debug UI.' },
            type: { type: 'string', description: 'Debug adapter type identifier, for example "node".' },
            request: { type: 'string', enum: ['launch', 'attach'], description: 'Whether the configuration launches or attaches.' },
            program: { type: 'string', description: 'Program entrypoint for launch requests.' },
            cwd: { type: 'string', description: 'Working directory for the debug target.' },
            args: {
              type: 'array',
              description: 'Command-line arguments passed to the program.',
              items: { type: 'string' },
              default: []
            },
            env: {
              type: 'object',
              description: 'Environment variable overrides applied to the debug target.',
              additionalProperties: { type: 'string' },
              default: {}
            },
            preLaunchTask: { type: 'string', description: 'Task identifier to run before debugging starts.' },
            stopOnEntry: { type: 'boolean', description: 'Whether to pause immediately on first line.', default: false },
            console: {
              type: 'string',
              enum: ['integratedTerminal', 'internalConsole', 'externalTerminal'],
              description: 'Console surface used for program IO.',
              default: 'integratedTerminal'
            }
          }
        }
      }
    }
  };
}

function validateLaunchConfiguration(configuration: unknown, basePath: string): LaunchConfigurationIssue[] {
  const issues: LaunchConfigurationIssue[] = [];
  if (!isPlainObject(configuration)) {
    return [{ path: basePath, message: 'Configuration entry must be an object.' }];
  }

  const requiredStringFields: Array<keyof Pick<LaunchConfiguration, 'name' | 'type'>> = ['name', 'type'];
  requiredStringFields.forEach(field => {
    const value = configuration[field];
    if (typeof value !== 'string' || !value.trim()) {
      issues.push({ path: `${basePath}.${field}`, message: `${field} must be a non-empty string.` });
    }
  });

  const request = configuration.request;
  if (typeof request !== 'string' || !VALID_REQUESTS.has(request as LaunchRequest)) {
    issues.push({
      path: `${basePath}.request`,
      message: 'request must be either "launch" or "attach".'
    });
  }

  const optionalStrings: Array<keyof Pick<LaunchConfiguration, 'program' | 'cwd' | 'preLaunchTask'>> = [
    'program',
    'cwd',
    'preLaunchTask'
  ];
  optionalStrings.forEach(field => {
    const value = configuration[field];
    if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
      issues.push({ path: `${basePath}.${field}`, message: `${field} must be a non-empty string when provided.` });
    }
  });

  if (configuration.args !== undefined) {
    if (!Array.isArray(configuration.args) || configuration.args.some(value => typeof value !== 'string')) {
      issues.push({ path: `${basePath}.args`, message: 'args must be an array of strings.' });
    }
  }

  if (configuration.env !== undefined) {
    if (!isPlainObject(configuration.env)) {
      issues.push({ path: `${basePath}.env`, message: 'env must be an object map of string values.' });
    } else {
      Object.entries(configuration.env).forEach(([key, value]) => {
        if (typeof value !== 'string') {
          issues.push({ path: `${basePath}.env.${key}`, message: 'Environment values must be strings.' });
        }
      });
    }
  }

  if (configuration.stopOnEntry !== undefined && typeof configuration.stopOnEntry !== 'boolean') {
    issues.push({ path: `${basePath}.stopOnEntry`, message: 'stopOnEntry must be a boolean.' });
  }

  if (configuration.console !== undefined) {
    if (typeof configuration.console !== 'string' || !VALID_CONSOLES.has(configuration.console as LaunchConsole)) {
      issues.push({
        path: `${basePath}.console`,
        message: 'console must be one of "integratedTerminal", "internalConsole", or "externalTerminal".'
      });
    }
  }

  return issues;
}

function normalizeDocument(document: LaunchConfigurationDocument): LaunchConfigurationDocument {
  return {
    version: document.version || LAUNCH_CONFIGURATION_VERSION,
    configurations: Array.isArray(document.configurations)
      ? document.configurations.map(configuration => normalizeConfiguration(configuration))
      : []
  };
}

function normalizeConfiguration(configuration: LaunchConfiguration): LaunchConfiguration {
  return {
    name: configuration.name,
    type: configuration.type,
    request: configuration.request,
    program: configuration.program?.trim() || undefined,
    cwd: configuration.cwd?.trim() || undefined,
    args: configuration.args ? [...configuration.args] : [],
    env: configuration.env ? { ...configuration.env } : {},
    preLaunchTask: configuration.preLaunchTask?.trim() || undefined,
    stopOnEntry: configuration.stopOnEntry ?? false,
    console: configuration.console ?? 'integratedTerminal'
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
