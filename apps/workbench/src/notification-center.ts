import { I18nService, type LocalizedText } from './i18n-service';

type Severity = 'info' | 'success' | 'warning' | 'error';

export type NotificationAction = {
  id: string;
  label: LocalizedText | string;
  commandId?: string;
  arguments?: unknown[];
};

export type NotificationPayload = {
  id?: string;
  title: LocalizedText | string;
  message: LocalizedText | string;
  severity?: Severity;
  detail?: string;
  source?: string;
  commandId?: string;
  actions?: NotificationAction[];
  expiresInMs?: number;
  sticky?: boolean;
  locale?: string;
};

export type NotificationRecord = NotificationPayload & {
  id: string;
  createdAt: number;
  acknowledged: boolean;
};

export type NotificationSnapshot = {
  items: NotificationRecord[];
  unseenCount: number;
  severityTally: Record<Severity, number>;
  locale: string;
};

type Listener = (snapshot: NotificationSnapshot) => void;

let counter = 0;

function nextNotificationId() {
  counter += 1;
  return `notice-${counter.toString(36)}`;
}

export class NotificationCenter {
  private readonly items: NotificationRecord[] = [];
  private readonly listeners = new Set<Listener>();
  private readonly i18n: I18nService;

  constructor(options: { locale?: string; i18n?: I18nService } = {}) {
    this.i18n =
      options.i18n ??
      new I18nService({
        locale: options.locale ?? process.env.NEXUS_LOCALE ?? 'en-US'
      });
    this.i18n.onDidChangeLocale(() => this.emit());
  }

  onDidChange(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  push(payload: NotificationPayload): string {
    const now = Date.now();
    const record: NotificationRecord = {
      severity: 'info',
      ...payload,
      id: payload.id ?? nextNotificationId(),
      createdAt: now,
      acknowledged: false,
      locale: payload.locale ?? this.i18n.getLocale()
    };
    this.items.unshift(record);
    this.trimExpired();
    this.emit();
    return record.id;
  }

  dismiss(id: string): boolean {
    const index = this.items.findIndex(item => item.id === id);
    if (index < 0) return false;
    this.items.splice(index, 1);
    this.emit();
    return true;
  }

  dismissAll(filter?: { severity?: Severity }) {
    if (!filter) {
      this.items.length = 0;
    } else {
      for (let i = this.items.length - 1; i >= 0; i--) {
        if (!filter.severity || this.items[i].severity === filter.severity) {
          this.items.splice(i, 1);
        }
      }
    }
    this.emit();
  }

  acknowledge(id: string) {
    const record = this.items.find(item => item.id === id);
    if (!record) return false;
    record.acknowledged = true;
    this.emit();
    return true;
  }

  getSnapshot(): NotificationSnapshot {
    this.trimExpired();
    const severityTally: Record<Severity, number> = {
      info: 0,
      success: 0,
      warning: 0,
      error: 0
    };
    this.items.forEach(item => {
      const severity = item.severity ?? 'info';
      severityTally[severity] += 1;
    });
    return {
      items: this.items.map(item => ({ ...item })),
      unseenCount: this.items.filter(item => !item.acknowledged).length,
      severityTally,
      locale: this.i18n.getLocale()
    };
  }

  private trimExpired() {
    const now = Date.now();
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (!item.sticky && item.expiresInMs && now - item.createdAt > item.expiresInMs) {
        this.items.splice(i, 1);
      }
    }
  }

  private emit() {
    if (!this.listeners.size) return;
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }

  formatLabel(content: string | LocalizedText) {
    return this.i18n.format(content);
  }
}
