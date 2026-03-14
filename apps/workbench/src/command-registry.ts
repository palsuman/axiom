import { type LocalizedText } from './i18n-service';

export type CommandHandler = (args?: unknown, context?: CommandExecutionContext) => unknown | Promise<unknown>;

export type Keybinding = {
  mac?: string;
  win?: string;
  linux?: string;
  when?: string;
};

export type CommandDefinition = {
  id: string;
  title: string | LocalizedText;
  category?: string;
  detail?: string | LocalizedText;
  enabled?: boolean | (() => boolean);
  handler?: CommandHandler;
  keybinding?: Keybinding;
  tags?: string[];
  hidden?: boolean;
};

export type CommandExecutionContext = {
  workspaceId?: string;
  resource?: string;
};

export type RegisteredCommand = CommandDefinition & {
  title: string | LocalizedText;
  detail?: string | LocalizedText;
  keybinding?: Keybinding;
};

export class CommandRegistry {
  private readonly commands = new Map<string, RegisteredCommand>();

  register(definition: CommandDefinition) {
    if (!definition.id) {
      throw new Error('Command id is required');
    }
    const existing = this.commands.get(definition.id);
    const next: RegisteredCommand = {
      ...existing,
      ...definition
    };
    this.commands.set(definition.id, next);
    return next;
  }

  get(id: string) {
    return this.commands.get(id);
  }

  list(options?: { includeHidden?: boolean }) {
    return [...this.commands.values()].filter(command => options?.includeHidden || !command.hidden);
  }

  async executeCommand(id: string, args?: unknown, context?: CommandExecutionContext) {
    const command = this.commands.get(id);
    if (!command) {
      throw new Error(`Command ${id} not found`);
    }
    const enabled = typeof command.enabled === 'function' ? command.enabled() : command.enabled !== false;
    if (!enabled) {
      throw new Error(`Command ${id} is disabled`);
    }
    if (!command.handler) {
      throw new Error(`Command ${id} has no handler`);
    }
    return command.handler(args, context);
  }
}
