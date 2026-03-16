import { Injectable, signal } from '@angular/core';
import { createDefaultIconThemeService, type IconThemeServiceSnapshot } from '@nexus/icons';
import { AngularThemeHostService } from './angular-theme-host.service';

@Injectable({ providedIn: 'root' })
export class AngularIconThemeHostService {
  private readonly iconThemeService: ReturnType<typeof createDefaultIconThemeService>;
  readonly snapshot = signal<IconThemeServiceSnapshot>(
    createDefaultIconThemeService().getSnapshot()
  );

  constructor(themeHost: AngularThemeHostService) {
    this.iconThemeService = createDefaultIconThemeService({
      themeRuntime: themeHost.getThemeRuntime()
    });
    this.snapshot.set(this.iconThemeService.getSnapshot());
    this.iconThemeService.onDidChange(nextSnapshot => {
      this.snapshot.set(nextSnapshot);
    });
  }

  resolveIcon(iconId: string) {
    const resolved = this.iconThemeService.resolveIcon(iconId);
    this.snapshot.set(this.iconThemeService.getSnapshot());
    return resolved;
  }

  resolveFileIcon(fileName: string, languageId?: string) {
    const resolved = this.iconThemeService.resolveFileIcon({ fileName, languageId });
    this.snapshot.set(this.iconThemeService.getSnapshot());
    return resolved;
  }
}
