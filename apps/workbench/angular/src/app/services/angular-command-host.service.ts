import { Injectable, signal } from '@angular/core';
import { INITIAL_ANGULAR_COMMAND_PALETTE_MODEL } from '../models/angular-command-palette.model';
import type { AngularCommandId } from '../types/angular-command-id';

@Injectable({ providedIn: 'root' })
export class AngularCommandHostService {
  readonly palette = signal(INITIAL_ANGULAR_COMMAND_PALETTE_MODEL);

  execute(commandId: AngularCommandId) {
    switch (commandId) {
      case 'nexus.commandPalette.show':
        this.palette.update(state => ({ ...state, open: true }));
        return;
      case 'nexus.commandPalette.hide':
        this.palette.update(state => ({ ...state, open: false }));
        return;
      case 'nexus.theme.toggle':
        return;
      default:
        this.assertNever(commandId);
    }
  }

  handleKeyboardShortcut(event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'key' | 'preventDefault'>) {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.execute('nexus.commandPalette.show');
      return;
    }

    if (event.key === 'Escape' && this.palette().open) {
      event.preventDefault();
      this.execute('nexus.commandPalette.hide');
    }
  }

  private assertNever(value: never): never {
    throw new Error(`Unsupported angular command: ${value}`);
  }
}
