import type { CommandRegistry } from './command-registry';
import { CommandPaletteService, type CommandPaletteSnapshot, type QuickOpenItem } from './command-palette';

export type CommandPaletteControllerSnapshot = {
  open: boolean;
  query: string;
  busy: boolean;
  error?: string;
  activeIndex: number;
  items: QuickOpenItem[];
  history: string[];
};

export type CommandPaletteControllerListener = (snapshot: CommandPaletteControllerSnapshot) => void;

export type CommandPaletteControllerKeyEvent = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  defaultPrevented?: boolean;
  preventDefault: () => void;
};

const EMPTY_SNAPSHOT: CommandPaletteControllerSnapshot = {
  open: false,
  query: '',
  busy: false,
  activeIndex: -1,
  items: [],
  history: []
};

export class CommandPaletteController {
  private state: CommandPaletteControllerSnapshot = EMPTY_SNAPSHOT;
  private readonly listeners = new Set<CommandPaletteControllerListener>();
  private requestSequence = 0;

  constructor(
    private readonly palette: CommandPaletteService,
    private readonly registry: CommandRegistry
  ) {}

  getSnapshot(): CommandPaletteControllerSnapshot {
    return {
      ...this.state,
      items: [...this.state.items],
      history: [...this.state.history]
    };
  }

  onDidChange(listener: CommandPaletteControllerListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async open(query = this.state.query): Promise<CommandPaletteControllerSnapshot> {
    this.patchState({
      open: true,
      query,
      busy: true,
      error: undefined
    });
    return this.refresh(query);
  }

  close() {
    this.patchState({
      open: false,
      busy: false,
      error: undefined
    });
  }

  async setQuery(query: string): Promise<CommandPaletteControllerSnapshot> {
    this.patchState({
      open: true,
      query,
      busy: true,
      error: undefined
    });
    return this.refresh(query);
  }

  selectNext() {
    if (!this.state.items.length) {
      return this.getSnapshot();
    }
    this.patchState({
      activeIndex: (this.state.activeIndex + 1 + this.state.items.length) % this.state.items.length
    });
    return this.getSnapshot();
  }

  selectPrevious() {
    if (!this.state.items.length) {
      return this.getSnapshot();
    }
    this.patchState({
      activeIndex: (this.state.activeIndex - 1 + this.state.items.length) % this.state.items.length
    });
    return this.getSnapshot();
  }

  selectIndex(index: number) {
    if (index < 0 || index >= this.state.items.length) {
      return this.getSnapshot();
    }
    this.patchState({
      activeIndex: index
    });
    return this.getSnapshot();
  }

  async executeActive() {
    const item = this.state.items[this.state.activeIndex];
    if (!item) {
      return undefined;
    }
    return this.executeItem(item);
  }

  async executeItemAt(index: number) {
    const item = this.state.items[index];
    if (!item) {
      return undefined;
    }
    this.selectIndex(index);
    return this.executeItem(item);
  }

  async handleKeydown(event: CommandPaletteControllerKeyEvent) {
    if (event.defaultPrevented) {
      return false;
    }

    if (matchesCommandPaletteShortcut(event)) {
      event.preventDefault();
      await this.open('');
      return true;
    }

    if (!this.state.open) {
      return false;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectNext();
        return true;
      case 'ArrowUp':
        event.preventDefault();
        this.selectPrevious();
        return true;
      case 'Enter':
        event.preventDefault();
        await this.executeActive();
        return true;
      case 'Escape':
        event.preventDefault();
        this.close();
        return true;
      default:
        return false;
    }
  }

  private async refresh(query: string): Promise<CommandPaletteControllerSnapshot> {
    const currentRequest = ++this.requestSequence;

    try {
      const snapshot = await this.palette.search(query);
      if (currentRequest !== this.requestSequence) {
        return this.getSnapshot();
      }
      this.applySearchSnapshot(snapshot);
    } catch (error) {
      if (currentRequest !== this.requestSequence) {
        return this.getSnapshot();
      }
      this.patchState({
        items: [],
        history: [],
        activeIndex: -1,
        busy: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return this.getSnapshot();
  }

  private applySearchSnapshot(snapshot: CommandPaletteSnapshot) {
    const activeId = this.state.items[this.state.activeIndex]?.id;
    const nextIndex = activeId ? snapshot.items.findIndex(item => item.id === activeId) : -1;
    this.patchState({
      query: snapshot.query,
      items: snapshot.items,
      history: snapshot.history,
      activeIndex: resolveActiveIndex(snapshot.items.length, nextIndex),
      busy: false,
      error: undefined
    });
  }

  private async executeItem(item: QuickOpenItem) {
    if (!item.commandId) {
      throw new Error(`Quick open item ${item.id} is missing a command id`);
    }

    try {
      const result = await this.registry.executeCommand(item.commandId, toCommandArgs(item.metadata));
      this.palette.recordSelection(item);
      this.close();
      return result;
    } catch (error) {
      this.patchState({
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private patchState(partial: Partial<CommandPaletteControllerSnapshot>) {
    this.state = {
      ...this.state,
      ...partial
    };
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }
}

export function matchesCommandPaletteShortcut(event: Pick<CommandPaletteControllerKeyEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>) {
  if (event.altKey) {
    return false;
  }
  const hasModifier = Boolean(event.metaKey || event.ctrlKey);
  return hasModifier && Boolean(event.shiftKey) && event.key.toLowerCase() === 'p';
}

function resolveActiveIndex(itemCount: number, currentIndex: number) {
  if (itemCount <= 0) {
    return -1;
  }
  if (currentIndex >= 0 && currentIndex < itemCount) {
    return currentIndex;
  }
  return 0;
}

function toCommandArgs(metadata: QuickOpenItem['metadata']) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return undefined;
  }
  return metadata;
}
