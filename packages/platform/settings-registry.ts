export type SettingsScope = 'user' | 'workspace';

export type SettingValueType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export type SettingDefinitionScope = SettingsScope | 'both';

export type SettingValidator<T> = {
  bivarianceHack(value: T): string | undefined;
}['bivarianceHack'];

export type SettingDefinition<T = unknown> = {
  readonly key: string;
  readonly type: SettingValueType;
  readonly description: string;
  readonly defaultValue: T;
  readonly scope?: SettingDefinitionScope;
  readonly enum?: readonly T[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly pattern?: RegExp | string;
  readonly validate?: SettingValidator<T>;
};

export type SettingInspection<T = unknown> = {
  readonly key: string;
  readonly definition: SettingDefinition<T>;
  readonly defaultValue: T;
  readonly userValue?: T;
  readonly workspaceValue?: T;
  readonly value: T;
};

export type SettingsApplyIssue = {
  readonly key: string;
  readonly scope: SettingsScope;
  readonly message: string;
  readonly source?: string;
};

export type SettingsChangeEvent = {
  readonly key: string;
  readonly scope: SettingsScope;
  readonly previousValue: unknown;
  readonly value: unknown;
  readonly source?: string;
};

export type SettingsApplyReport = {
  readonly scope: SettingsScope;
  readonly changedKeys: string[];
  readonly issues: SettingsApplyIssue[];
};

export type SettingSchemaProperty = {
  readonly type: SettingValueType;
  readonly description: string;
  readonly default: unknown;
  readonly scope: SettingDefinitionScope;
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly pattern?: string;
};

export type SettingsSchemaDocument = {
  readonly $schema: 'https://json-schema.org/draft/2020-12/schema';
  readonly type: 'object';
  readonly additionalProperties: false;
  readonly properties: Record<string, SettingSchemaProperty>;
};

const DEFAULT_SCOPE: SettingDefinitionScope = 'both';

export class SettingsRegistry {
  private readonly definitions = new Map<string, SettingDefinition<unknown>>();
  private readonly userValues = new Map<string, unknown>();
  private readonly workspaceValues = new Map<string, unknown>();
  private readonly listeners = new Set<(event: SettingsChangeEvent) => void>();

  register<T>(definition: SettingDefinition<T>) {
    const normalized = normalizeDefinition(definition);
    if (this.definitions.has(normalized.key)) {
      throw new Error(`Setting "${normalized.key}" is already registered`);
    }
    validateValue(normalized.key, normalized.defaultValue, normalized, 'default');
    this.definitions.set(normalized.key, normalized as SettingDefinition<unknown>);
    return normalized;
  }

  registerMany(definitions: readonly SettingDefinition[]) {
    return definitions.map(definition => this.register(definition));
  }

  has(key: string) {
    return this.definitions.has(key);
  }

  get<T>(key: string): T {
    return this.inspect<T>(key).value;
  }

  inspect<T>(key: string): SettingInspection<T> {
    const definition = this.getDefinitionOrThrow<T>(key);
    return {
      key,
      definition,
      defaultValue: cloneValue(definition.defaultValue),
      userValue: cloneOptional(this.userValues.get(key) as T | undefined),
      workspaceValue: cloneOptional(this.workspaceValues.get(key) as T | undefined),
      value: cloneValue(this.resolveValue(key, definition))
    };
  }

  applyValues(scope: SettingsScope, values: Record<string, unknown>, options?: { source?: string }): SettingsApplyReport {
    const changedKeys: string[] = [];
    const issues: SettingsApplyIssue[] = [];

    Object.entries(values).forEach(([key, value]) => {
      const definition = this.definitions.get(key);
      if (!definition) {
        issues.push(buildIssue(key, scope, `Unknown setting "${key}"`, options?.source));
        return;
      }
      if (!supportsScope(definition, scope)) {
        issues.push(
          buildIssue(
            key,
            scope,
            `Setting "${key}" does not support ${scope} overrides`,
            options?.source
          )
        );
        return;
      }
      const error = validateMaybe(definition, key, value);
      if (error) {
        issues.push(buildIssue(key, scope, error, options?.source));
        return;
      }

      const previousValue = this.resolveValue(key, definition);
      const store = scope === 'user' ? this.userValues : this.workspaceValues;
      const previousScopedValue = store.get(key);
      if (isEqual(previousScopedValue, value)) {
        return;
      }

      store.set(key, cloneValue(value));
      const nextValue = this.resolveValue(key, definition);
      if (!isEqual(previousValue, nextValue)) {
        changedKeys.push(key);
        this.emitChange({
          key,
          scope,
          previousValue: cloneValue(previousValue),
          value: cloneValue(nextValue),
          source: options?.source
        });
      }
    });

    return {
      scope,
      changedKeys,
      issues
    };
  }

  removeValue(scope: SettingsScope, key: string, options?: { source?: string }) {
    const definition = this.getDefinitionOrThrow(key);
    const store = scope === 'user' ? this.userValues : this.workspaceValues;
    if (!store.has(key)) {
      return false;
    }
    const previousValue = this.resolveValue(key, definition);
    store.delete(key);
    const nextValue = this.resolveValue(key, definition);
    if (!isEqual(previousValue, nextValue)) {
      this.emitChange({
        key,
        scope,
        previousValue: cloneValue(previousValue),
        value: cloneValue(nextValue),
        source: options?.source
      });
    }
    return true;
  }

  listDefinitions() {
    return [...this.definitions.values()].map(definition => ({
      ...definition,
      defaultValue: cloneValue(definition.defaultValue),
      enum: definition.enum ? cloneValue(definition.enum) : undefined
    }));
  }

  getUserValues() {
    return mapToObject(this.userValues);
  }

  getWorkspaceValues() {
    return mapToObject(this.workspaceValues);
  }

  getResolvedValues() {
    const resolved: Record<string, unknown> = {};
    this.definitions.forEach((definition, key) => {
      resolved[key] = cloneValue(this.resolveValue(key, definition));
    });
    return resolved;
  }

  toJSONSchema(): SettingsSchemaDocument {
    const properties: Record<string, SettingSchemaProperty> = {};
    this.definitions.forEach(definition => {
      properties[definition.key] = {
        type: definition.type,
        description: definition.description,
        default: cloneValue(definition.defaultValue),
        scope: definition.scope ?? DEFAULT_SCOPE,
        enum: definition.enum ? cloneValue(definition.enum) : undefined,
        minimum: definition.minimum,
        maximum: definition.maximum,
        pattern: definition.pattern instanceof RegExp ? definition.pattern.source : definition.pattern
      };
    });
    return {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
      properties
    };
  }

  onDidChange(listener: (event: SettingsChangeEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitChange(event: SettingsChangeEvent) {
    if (!this.listeners.size) {
      return;
    }
    this.listeners.forEach(listener => listener(event));
  }

  private resolveValue<T>(key: string, definition: SettingDefinition<T>) {
    if (this.workspaceValues.has(key) && supportsScope(definition, 'workspace')) {
      return this.workspaceValues.get(key) as T;
    }
    if (this.userValues.has(key)) {
      return this.userValues.get(key) as T;
    }
    return definition.defaultValue;
  }

  private getDefinitionOrThrow<T>(key: string): SettingDefinition<T> {
    const definition = this.definitions.get(key);
    if (!definition) {
      throw new Error(`Setting "${key}" is not registered`);
    }
    return definition as SettingDefinition<T>;
  }
}

function normalizeDefinition<T>(definition: SettingDefinition<T>): SettingDefinition<T> {
  if (!definition.key || !definition.key.trim()) {
    throw new Error('Setting key is required');
  }
  if (!definition.description || !definition.description.trim()) {
    throw new Error(`Setting "${definition.key}" requires a description`);
  }
  return {
    ...definition,
    key: definition.key.trim(),
    scope: definition.scope ?? DEFAULT_SCOPE
  };
}

function supportsScope(definition: SettingDefinition<unknown>, scope: SettingsScope) {
  return definition.scope === 'both' || definition.scope === scope;
}

function buildIssue(key: string, scope: SettingsScope, message: string, source?: string): SettingsApplyIssue {
  return { key, scope, message, source };
}

function validateMaybe(definition: SettingDefinition<unknown>, key: string, value: unknown) {
  try {
    validateValue(key, value, definition, 'value');
    return undefined;
  } catch (error) {
    return (error as Error).message;
  }
}

function validateValue(
  key: string,
  value: unknown,
  definition: SettingDefinition<unknown>,
  label: 'default' | 'value'
) {
  if (!matchesType(value, definition.type)) {
    throw new Error(`Invalid ${label} for "${key}": expected ${definition.type}`);
  }
  if (definition.enum && !definition.enum.some(candidate => isEqual(candidate, value))) {
    throw new Error(`Invalid ${label} for "${key}": expected one of ${definition.enum.join(', ')}`);
  }
  if ((definition.type === 'number' || definition.type === 'integer') && typeof value === 'number') {
    if (definition.minimum !== undefined && value < definition.minimum) {
      throw new Error(`Invalid ${label} for "${key}": must be >= ${definition.minimum}`);
    }
    if (definition.maximum !== undefined && value > definition.maximum) {
      throw new Error(`Invalid ${label} for "${key}": must be <= ${definition.maximum}`);
    }
  }
  if (definition.type === 'string' && typeof value === 'string' && definition.pattern) {
    const pattern = definition.pattern instanceof RegExp ? definition.pattern : new RegExp(definition.pattern);
    if (!pattern.test(value)) {
      throw new Error(`Invalid ${label} for "${key}": does not match required pattern`);
    }
  }
  const customError = definition.validate?.(cloneValue(value));
  if (customError) {
    throw new Error(`Invalid ${label} for "${key}": ${customError}`);
  }
}

function matchesType(value: unknown, expected: SettingValueType) {
  switch (expected) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    default:
      return false;
  }
}

function mapToObject(values: Map<string, unknown>) {
  const result: Record<string, unknown> = {};
  values.forEach((value, key) => {
    result[key] = cloneValue(value);
  });
  return result;
}

function cloneOptional<T>(value: T | undefined) {
  return value === undefined ? undefined : cloneValue(value);
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function isEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}
