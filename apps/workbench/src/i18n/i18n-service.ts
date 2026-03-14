export type LocalizedText = {
  key: string;
  fallback: string;
  args?: Record<string, string | number>;
};

export type TranslationBundle = {
  locale: string;
  entries: Record<string, string>;
};

export type MissingTranslationEvent = {
  locale: string;
  key: string;
  fallback: string;
};

type LocaleChangeListener = (locale: string) => void;
type MissingTranslationListener = (event: MissingTranslationEvent) => void;

export const WORKBENCH_SUPPORTED_LOCALES = ['en-US', 'fr-FR', 'es-ES'] as const;

export const WORKBENCH_I18N_BUNDLES: TranslationBundle[] = [
  {
    locale: 'en-US',
    entries: {
      'command.commandPalette.show': 'Show Command Palette',
      'command.notifications.show': 'Show Notifications',
      'command.panel.toggle': 'Toggle Bottom Panel',
      'command.sidebar.toggle': 'Toggle Sidebar',
      'command.status.encoding': 'Change File Encoding',
      'command.status.encoding.detail': 'Returns the resolved default file encoding',
      'command.locale.switch': 'Switch Display Language',
      'command.locale.switch.detail': 'Changes the active language and persists it to user settings',
      'command.locale.cycle': 'Cycle Display Language',
      'command.locale.cycle.detail': 'Cycles between supported workbench languages',
      'quickopen.workspace.open': 'Open Workspace…',
      'quickopen.workspace.open.detail': 'Pick a folder to open',
      'quickopen.locale.current': 'Current language',
      'quickopen.locale.select.detail': 'Switch display language to {locale}',
      'notification.locale.updated.title': 'Display language updated',
      'notification.locale.updated.message': 'Nexus now uses {locale}.',
      'status.notifications.none': '0 Notifications',
      'status.notifications.count.one': '{count} Notification',
      'status.notifications.count.other': '{count} Notifications',
      'status.notifications.tooltip.pending': 'View pending notifications',
      'status.notifications.tooltip.none': 'All caught up',
      'status.notifications.aria.pending': '{count} pending notifications',
      'status.notifications.aria.none': 'No pending notifications',
      'status.locale.current': 'Language: {locale}',
      'locale.name.en-US': 'English (US)',
      'locale.name.fr-FR': 'Français',
      'locale.name.es-ES': 'Español'
    }
  },
  {
    locale: 'fr-FR',
    entries: {
      'command.commandPalette.show': 'Afficher la palette de commandes',
      'command.notifications.show': 'Afficher les notifications',
      'command.panel.toggle': 'Afficher ou masquer le panneau inférieur',
      'command.sidebar.toggle': 'Afficher ou masquer la barre latérale',
      'command.status.encoding': 'Changer l’encodage du fichier',
      'command.status.encoding.detail': 'Retourne l’encodage de fichier résolu',
      'command.locale.switch': 'Changer la langue de l’interface',
      'command.locale.switch.detail': 'Change la langue active et la conserve dans les paramètres utilisateur',
      'command.locale.cycle': 'Faire défiler les langues',
      'command.locale.cycle.detail': 'Parcourt les langues prises en charge',
      'quickopen.workspace.open': 'Ouvrir un espace de travail…',
      'quickopen.workspace.open.detail': 'Choisir un dossier à ouvrir',
      'quickopen.locale.current': 'Langue actuelle',
      'quickopen.locale.select.detail': 'Utiliser {locale} comme langue d’affichage',
      'notification.locale.updated.title': 'Langue d’affichage mise à jour',
      'notification.locale.updated.message': 'Nexus utilise maintenant {locale}.',
      'status.notifications.none': '0 notification',
      'status.notifications.count.one': '{count} notification',
      'status.notifications.count.other': '{count} notifications',
      'status.notifications.tooltip.pending': 'Afficher les notifications en attente',
      'status.notifications.tooltip.none': 'Tout est à jour',
      'status.notifications.aria.pending': '{count} notifications en attente',
      'status.notifications.aria.none': 'Aucune notification en attente',
      'status.locale.current': 'Langue : {locale}',
      'locale.name.en-US': 'Anglais (US)',
      'locale.name.fr-FR': 'Français',
      'locale.name.es-ES': 'Espagnol'
    }
  },
  {
    locale: 'es-ES',
    entries: {
      'command.commandPalette.show': 'Mostrar paleta de comandos',
      'command.notifications.show': 'Mostrar notificaciones',
      'command.panel.toggle': 'Mostrar u ocultar el panel inferior',
      'command.sidebar.toggle': 'Mostrar u ocultar la barra lateral',
      'command.status.encoding': 'Cambiar la codificación del archivo',
      'command.status.encoding.detail': 'Devuelve la codificación de archivo resuelta',
      'command.locale.switch': 'Cambiar idioma de la interfaz',
      'command.locale.switch.detail': 'Cambia el idioma activo y lo guarda en la configuración del usuario',
      'command.locale.cycle': 'Alternar idioma de la interfaz',
      'command.locale.cycle.detail': 'Alterna entre los idiomas compatibles',
      'quickopen.workspace.open': 'Abrir espacio de trabajo…',
      'quickopen.workspace.open.detail': 'Elegir una carpeta para abrir',
      'quickopen.locale.current': 'Idioma actual',
      'quickopen.locale.select.detail': 'Cambiar el idioma de la interfaz a {locale}',
      'notification.locale.updated.title': 'Idioma de la interfaz actualizado',
      'notification.locale.updated.message': 'Nexus ahora usa {locale}.',
      'status.notifications.none': '0 notificaciones',
      'status.notifications.count.one': '{count} notificación',
      'status.notifications.count.other': '{count} notificaciones',
      'status.notifications.tooltip.pending': 'Ver notificaciones pendientes',
      'status.notifications.tooltip.none': 'Todo al día',
      'status.notifications.aria.pending': '{count} notificaciones pendientes',
      'status.notifications.aria.none': 'No hay notificaciones pendientes',
      'status.locale.current': 'Idioma: {locale}',
      'locale.name.en-US': 'Inglés (EE. UU.)',
      'locale.name.fr-FR': 'Francés',
      'locale.name.es-ES': 'Español'
    }
  }
];

export class I18nService {
  private readonly bundles = new Map<string, Map<string, string>>();
  private readonly localeListeners = new Set<LocaleChangeListener>();
  private readonly missingListeners = new Set<MissingTranslationListener>();
  private locale: string;
  private readonly fallbackLocale: string;

  constructor(options: { locale?: string; fallbackLocale?: string; bundles?: TranslationBundle[] } = {}) {
    this.locale = normalizeLocale(options.locale ?? 'en-US');
    this.fallbackLocale = normalizeLocale(options.fallbackLocale ?? 'en-US');
    options.bundles?.forEach(bundle => this.registerBundle(bundle));
  }

  registerBundle(bundle: TranslationBundle) {
    const locale = normalizeLocale(bundle.locale);
    const existing = this.bundles.get(locale) ?? new Map<string, string>();
    Object.entries(bundle.entries).forEach(([key, value]) => {
      existing.set(key, value);
    });
    this.bundles.set(locale, existing);
  }

  registerBundles(bundles: readonly TranslationBundle[]) {
    bundles.forEach(bundle => this.registerBundle(bundle));
  }

  getLocale() {
    return this.locale;
  }

  setLocale(locale: string) {
    const normalized = normalizeLocale(locale);
    if (normalized === this.locale) {
      return false;
    }
    this.locale = normalized;
    this.localeListeners.forEach(listener => listener(this.locale));
    return true;
  }

  getSupportedLocales() {
    return [...new Set([this.fallbackLocale, this.locale, ...this.bundles.keys()])].sort((left, right) =>
      left.localeCompare(right)
    );
  }

  hasLocale(locale: string) {
    return this.bundles.has(normalizeLocale(locale));
  }

  format(content: string | LocalizedText, options?: { locale?: string }) {
    if (typeof content === 'string') {
      return content;
    }
    return this.translate(content.key, {
      locale: options?.locale,
      fallback: content.fallback,
      args: content.args
    });
  }

  translate(
    key: string,
    options: { locale?: string; fallback?: string; args?: Record<string, string | number> } = {}
  ) {
    const locale = normalizeLocale(options.locale ?? this.locale);
    const template =
      this.lookup(locale, key) ??
      this.lookup(this.fallbackLocale, key) ??
      options.fallback ??
      key;

    if (!this.lookup(locale, key) && !this.lookup(this.fallbackLocale, key)) {
      this.emitMissing({
        locale,
        key,
        fallback: options.fallback ?? key
      });
    }

    return interpolate(template, options.args);
  }

  getLocaleDisplayName(locale: string, options?: { displayLocale?: string }) {
    const normalized = normalizeLocale(locale);
    const displayLocale = normalizeLocale(options?.displayLocale ?? this.locale);
    return this.translate(`locale.name.${normalized}`, {
      locale: displayLocale,
      fallback: normalized
    });
  }

  onDidChangeLocale(listener: LocaleChangeListener) {
    this.localeListeners.add(listener);
    return () => this.localeListeners.delete(listener);
  }

  onMissingTranslation(listener: MissingTranslationListener) {
    this.missingListeners.add(listener);
    return () => this.missingListeners.delete(listener);
  }

  private emitMissing(event: MissingTranslationEvent) {
    this.missingListeners.forEach(listener => listener(event));
  }

  private lookup(locale: string, key: string) {
    return this.bundles.get(locale)?.get(key);
  }
}

function normalizeLocale(locale: string) {
  return locale.trim().replace('_', '-');
}

function interpolate(template: string, args?: Record<string, string | number>) {
  if (!args) {
    return template;
  }
  return template.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = args[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}
