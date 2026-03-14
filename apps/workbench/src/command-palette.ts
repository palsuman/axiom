import { CommandRegistry, type RegisteredCommand } from './command-registry';
import { fuzzyScore } from './fuzzy-match';
import { I18nService, type LocalizedText } from './i18n-service';
import { type StatusContent } from './workbench-shell';

export type QuickOpenItemType = 'command' | 'recent' | 'workspace' | 'custom';

export type QuickOpenItem = {
  id: string;
  type: QuickOpenItemType;
  label: string;
  detail?: string;
  description?: string;
  score: number;
  commandId?: string;
  group?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type QuickOpenProvider = {
  id: string;
  getItems(query: string): Promise<QuickOpenItem[]> | QuickOpenItem[];
};

export type CommandPaletteSnapshot = {
  query: string;
  timestamp: number;
  items: QuickOpenItem[];
  history: string[];
};

export class CommandPaletteService {
  private readonly providers = new Map<string, QuickOpenProvider>();
  private readonly history: string[] = [];
  private readonly registry: CommandRegistry;
  private readonly i18n: I18nService;

  constructor(registry: CommandRegistry, options: { i18n?: I18nService } = {}) {
    this.registry = registry;
    this.i18n =
      options.i18n ??
      new I18nService({
        locale: process.env.NEXUS_LOCALE ?? 'en-US'
      });
    this.registerProvider({
      id: 'commands',
      getItems: query => this.getCommandItems(query)
    });
  }

  registerProvider(provider: QuickOpenProvider) {
    this.providers.set(provider.id, provider);
  }

  unregisterProvider(id: string) {
    this.providers.delete(id);
  }

  async search(query: string): Promise<CommandPaletteSnapshot> {
    const sanitized = query.trim();
    const items: QuickOpenItem[] = [];
    for (const provider of this.providers.values()) {
      const results = await provider.getItems(sanitized);
      items.push(...results);
    }
    items.sort((a, b) => b.score - a.score);
    return {
      query: sanitized,
      timestamp: Date.now(),
      items,
      history: [...this.history]
    };
  }

  recordSelection(item: QuickOpenItem) {
    this.history.unshift(item.id);
    if (this.history.length > 20) {
      this.history.length = 20;
    }
  }

  private getCommandItems(query: string) {
    const commands = this.registry.list().filter(command => !command.hidden);
    const computed: QuickOpenItem[] = commands
      .map(command => this.toQuickOpenItem(command, query))
      .filter(item => item.score > 0 || !query);
    return computed;
  }

  private toQuickOpenItem(command: RegisteredCommand, query: string): QuickOpenItem {
    const label = this.resolveLocalized(command.title);
    const detailParts: string[] = [];
    if (command.category) {
      detailParts.push(command.category);
    }
    if (command.keybinding?.mac) {
      detailParts.push(command.keybinding.mac);
    }
    const detail = detailParts.join(' • ') || undefined;
    const score = query ? fuzzyScore(query, label) : 0.01;
    return {
      id: `command:${command.id}`,
      type: 'command',
      label,
      detail,
      description: command.detail ? this.resolveLocalized(command.detail) : undefined,
      score,
      commandId: command.id,
      group: command.category
    };
  }

  private resolveLocalized(value: string | LocalizedText | StatusContent) {
    if (typeof value === 'string') {
      return value;
    }
    return this.i18n.format(value);
  }
}
