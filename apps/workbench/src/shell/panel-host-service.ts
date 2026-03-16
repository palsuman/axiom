import type { PanelViewRegistration, WorkbenchShell } from './workbench-shell';

export type PanelAction = {
  id: string;
  label: string;
  commandId: string;
  args?: Record<string, unknown>;
  variant?: 'primary' | 'secondary';
};

export type OutputEntryLevel = 'info' | 'warning' | 'error';

export type OutputEntry = {
  id: string;
  text: string;
  level: OutputEntryLevel;
  timestamp: number;
};

export type OutputChannelSnapshot = {
  id: string;
  label: string;
  entries: OutputEntry[];
};

export type ProblemEntry = {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  resource?: string;
  line?: number;
  column?: number;
  source?: string;
};

export type PanelRenderContext = {
  outputChannels: OutputChannelSnapshot[];
  activeOutputChannelId?: string;
  problems: ProblemEntry[];
};

export type PanelContent =
  | {
      kind: 'terminal';
      title: string;
      description?: string;
      actions?: PanelAction[];
    }
  | {
      kind: 'output';
      title: string;
      channels: OutputChannelSnapshot[];
      activeChannelId?: string;
      actions?: PanelAction[];
    }
  | {
      kind: 'problems';
      title: string;
      summary: string;
      entries: ProblemEntry[];
      actions?: PanelAction[];
    }
  | {
      kind: 'empty';
      title: string;
      message: string;
      actions?: PanelAction[];
    };

export type PanelContribution = PanelViewRegistration & {
  render: (context: PanelRenderContext) => PanelContent;
};

type PanelHostListener = () => void;

const OUTPUT_ENTRY_LIMIT = 200;

export class PanelHostService {
  private readonly listeners = new Set<PanelHostListener>();
  private readonly contributions = new Map<string, PanelContribution>();
  private readonly outputChannels = new Map<string, OutputChannelSnapshot>();
  private activeOutputChannelId?: string;
  private problems: ProblemEntry[] = [];

  constructor(private readonly shell: WorkbenchShell) {}

  registerContribution(contribution: PanelContribution) {
    this.contributions.set(contribution.id, contribution);
    this.shell.registerPanelView(contribution);
    this.emitChange();
    return () => {
      this.contributions.delete(contribution.id);
      this.shell.unregisterPanelView(contribution.id);
      this.emitChange();
    };
  }

  renderActivePanel() {
    const activePanelId = this.shell.layoutSnapshot().panel.activeViewId;
    return this.renderPanel(activePanelId);
  }

  renderPanel(panelId?: string): PanelContent {
    if (!panelId) {
      return {
        kind: 'empty',
        title: 'Panel',
        message: 'No panel is active.'
      };
    }
    const contribution = this.contributions.get(panelId);
    if (!contribution) {
      return {
        kind: 'empty',
        title: panelId,
        message: `No panel contribution is registered for ${panelId}.`
      };
    }
    return contribution.render({
      outputChannels: this.getOutputChannels(),
      activeOutputChannelId: this.activeOutputChannelId,
      problems: this.getProblems()
    });
  }

  appendOutputEntry(channelId: string, label: string, text: string, options: { level?: OutputEntryLevel } = {}) {
    const normalizedChannelId = channelId.trim();
    const normalizedLabel = label.trim();
    const normalizedText = text.trim();
    if (!normalizedChannelId || !normalizedLabel || !normalizedText) {
      throw new Error('Output channel id, label, and text are required');
    }
    const existing = this.outputChannels.get(normalizedChannelId);
    const entry: OutputEntry = {
      id: createPanelItemId('output'),
      text: normalizedText,
      level: options.level ?? 'info',
      timestamp: Date.now()
    };
    const entries = [...(existing?.entries ?? []), entry].slice(-OUTPUT_ENTRY_LIMIT);
    this.outputChannels.set(normalizedChannelId, {
      id: normalizedChannelId,
      label: normalizedLabel,
      entries
    });
    this.activeOutputChannelId = this.activeOutputChannelId ?? normalizedChannelId;
    this.emitChange();
    return entry;
  }

  clearOutputChannel(channelId: string) {
    if (!this.outputChannels.has(channelId)) {
      return false;
    }
    this.outputChannels.delete(channelId);
    if (this.activeOutputChannelId === channelId) {
      this.activeOutputChannelId = this.outputChannels.keys().next().value;
    }
    this.emitChange();
    return true;
  }

  setActiveOutputChannel(channelId?: string) {
    if (!channelId) {
      this.activeOutputChannelId = undefined;
      this.emitChange();
      return true;
    }
    if (!this.outputChannels.has(channelId)) {
      return false;
    }
    this.activeOutputChannelId = channelId;
    this.emitChange();
    return true;
  }

  replaceProblems(entries: ProblemEntry[]) {
    this.problems = entries.map(entry => ({ ...entry }));
    this.emitChange();
  }

  getProblems() {
    return this.problems.map(entry => ({ ...entry }));
  }

  getOutputChannels() {
    return [...this.outputChannels.values()].map(channel => ({
      ...channel,
      entries: channel.entries.map(entry => ({ ...entry }))
    }));
  }

  onDidChange(listener: PanelHostListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose() {
    this.listeners.clear();
    this.contributions.clear();
    this.outputChannels.clear();
    this.problems = [];
  }

  private emitChange() {
    this.listeners.forEach(listener => listener());
  }
}

export function createDefaultPanelActions() {
  return [
    {
      id: 'panel.move.bottom',
      label: 'Dock Bottom',
      commandId: 'nexus.panel.position.bottom',
      variant: 'secondary' as const
    },
    {
      id: 'panel.move.right',
      label: 'Dock Right',
      commandId: 'nexus.panel.position.right',
      variant: 'secondary' as const
    }
  ];
}

export function createProblemSummary(entries: ProblemEntry[]) {
  const errors = entries.filter(entry => entry.severity === 'error').length;
  const warnings = entries.filter(entry => entry.severity === 'warning').length;
  const infos = entries.filter(entry => entry.severity === 'info').length;

  if (!entries.length) {
    return 'No problems detected.';
  }

  const parts: string[] = [];
  if (errors) {
    parts.push(`${errors} error${errors === 1 ? '' : 's'}`);
  }
  if (warnings) {
    parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
  }
  if (infos) {
    parts.push(`${infos} info`);
  }
  return parts.join(' • ');
}

let panelItemId = 0;

function createPanelItemId(prefix: string) {
  panelItemId += 1;
  return `${prefix}-${panelItemId.toString(36)}`;
}
