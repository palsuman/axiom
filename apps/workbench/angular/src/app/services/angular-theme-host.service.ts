import { Injectable, signal } from '@angular/core';
import { createDefaultThemeRuntime, type ThemeRuntime, type ThemeRuntimeSnapshot } from '@nexus/platform/theming/theme-runtime';
import type { AngularThemeId } from '../types/angular-theme-id';

@Injectable({ providedIn: 'root' })
export class AngularThemeHostService {
  readonly theme = signal<AngularThemeId>('Nexus Dark');
  readonly themeKind = signal<'light' | 'dark' | 'high-contrast'>('dark');

  private readonly themeRuntime: ThemeRuntime;
  private disposeThemeBinding?: () => void;

  constructor() {
    this.themeRuntime = createDefaultThemeRuntime({ initialThemeId: 'Nexus Dark' });
  }

  initialize(documentRef: Document = document) {
    this.disposeThemeBinding?.();
    this.applySnapshot(this.themeRuntime.getSnapshot(), documentRef);
    this.disposeThemeBinding = this.themeRuntime.onDidChange(event => {
      this.applySnapshot(event.snapshot, documentRef);
    });
  }

  getThemeRuntime() {
    return this.themeRuntime;
  }

  toggleTheme() {
    const nextTheme = this.theme() === 'Nexus Dark' ? 'Nexus Light' : 'Nexus Dark';
    this.themeRuntime.setTheme(nextTheme);
  }

  applyTheme(themeId: AngularThemeId) {
    this.themeRuntime.setTheme(themeId);
  }

  private applySnapshot(snapshot: ThemeRuntimeSnapshot, documentRef: Document) {
    this.theme.set(snapshot.activeThemeId as AngularThemeId);
    this.themeKind.set(snapshot.theme.kind);

    const root = documentRef.documentElement;
    root.setAttribute('data-nexus-theme', snapshot.activeThemeId);
    root.setAttribute('data-nexus-theme-kind', snapshot.theme.kind);
    root.style.setProperty('color-scheme', snapshot.theme.kind === 'light' ? 'light' : 'dark');

    Object.entries(snapshot.cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    root.style.setProperty('--nexus-bg', snapshot.colors['workbench.background']);
    root.style.setProperty('--nexus-surface', snapshot.colors['panel.background']);
    root.style.setProperty('--nexus-border', snapshot.colors.border);
    root.style.setProperty('--nexus-text', snapshot.colors.foreground);
    root.style.setProperty('--nexus-muted', snapshot.colors['input.foreground']);
    root.style.setProperty('--nexus-accent', snapshot.colors['button.background']);
    root.style.setProperty('--nexus-success', snapshot.colors['statusBar.background']);
  }
}
