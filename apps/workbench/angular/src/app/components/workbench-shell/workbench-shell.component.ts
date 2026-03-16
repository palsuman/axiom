import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL } from '../../models/angular-workbench-shell.model';
import { AngularCommandHostService } from '../../services/angular-command-host.service';
import { AngularIconThemeHostService } from '../../services/angular-icon-theme-host.service';
import { AngularWorkbenchLayoutService } from '../../services/angular-workbench-layout.service';
import { AngularWorkbenchShellService } from '../../services/angular-workbench-shell.service';
import { AngularThemeHostService } from '../../services/angular-theme-host.service';

@Component({
  selector: 'nexus-angular-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workbench-shell.component.html',
  styleUrl: './workbench-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown)': 'onWindowKeydown($event)'
  }
})
export class WorkbenchShellComponent implements OnInit {
  readonly model = signal(INITIAL_ANGULAR_WORKBENCH_SHELL_MODEL);

  constructor(
    private readonly shellService: AngularWorkbenchShellService,
    readonly commandHost: AngularCommandHostService,
    readonly iconThemeHost: AngularIconThemeHostService,
    readonly layoutService: AngularWorkbenchLayoutService,
    private readonly themeHost: AngularThemeHostService
  ) {}

  ngOnInit() {
    this.themeHost.initialize();
    this.iconThemeHost.resolveIcon('icon.fallback');
    this.iconThemeHost.resolveFileIcon('package.json', 'json');
    void this.load();
  }

  showCommandPalette() {
    this.commandHost.execute('nexus.commandPalette.show');
  }

  closeCommandPalette() {
    this.commandHost.execute('nexus.commandPalette.hide');
  }

  toggleTheme() {
    this.themeHost.toggleTheme();
    this.model.update(state => ({
      ...state,
      activeThemeId: this.themeHost.theme(),
      shell: this.layoutService.snapshot()
    }));
  }

  cycleLocale() {
    this.layoutService.cycleLocale();
    this.model.update(state => ({
      ...state,
      locale: this.layoutService.locale(),
      shell: this.layoutService.snapshot()
    }));
  }

  activateActivity(activityId: string) {
    this.layoutService.activateActivity(activityId);
    this.syncShellSnapshot();
  }

  activateSidebarView(viewId: string, target: 'primary' | 'secondary' = 'primary') {
    this.layoutService.activateSidebarView(viewId, target);
    this.syncShellSnapshot();
  }

  activatePanelView(viewId: string) {
    this.layoutService.activatePanelView(viewId);
    this.syncShellSnapshot();
  }

  setPanelPosition(position: 'bottom' | 'right') {
    this.layoutService.setPanelPosition(position);
    this.syncShellSnapshot();
  }

  togglePrimarySidebar() {
    this.layoutService.togglePrimarySidebar();
    this.syncShellSnapshot();
  }

  openSettings() {
    this.layoutService.openSettings();
    this.syncShellSnapshot();
  }

  focusEditor(resource: string) {
    this.layoutService.focusEditor(resource);
    this.syncShellSnapshot();
  }

  getPlacementStyle(surface: 'activityBar' | 'primarySidebar' | 'secondarySidebar' | 'editor' | 'panel' | 'statusBar') {
    const placement = this.model().shell.placements[surface];
    return {
      gridColumn: `${placement.columnStart} / ${placement.columnEnd}`,
      gridRow: `${placement.rowStart} / ${placement.rowEnd}`
    };
  }

  getActiveEditorResource(groupId: string) {
    const group = this.model().shell.editors.groups.find(entry => entry.id === groupId);
    const activeTab = group?.tabs.find(entry => entry.id === group?.activeTabId);
    return activeTab?.resource ?? 'No file selected';
  }

  onWindowKeydown(event: KeyboardEvent) {
    this.commandHost.handleKeyboardShortcut(event);
  }

  private async load() {
    this.model.set(await this.shellService.load());
  }

  private syncShellSnapshot() {
    this.model.update(state => ({
      ...state,
      locale: this.layoutService.locale(),
      activeThemeId: this.themeHost.theme(),
      shell: this.layoutService.snapshot()
    }));
  }
}
