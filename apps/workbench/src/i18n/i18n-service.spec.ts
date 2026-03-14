import { I18nService, WORKBENCH_I18N_BUNDLES } from './i18n-service';

describe('I18nService', () => {
  it('formats localized text with interpolation and locale fallback', () => {
    const service = new I18nService({
      locale: 'fr-FR',
      bundles: WORKBENCH_I18N_BUNDLES
    });

    expect(
      service.translate('notification.locale.updated.message', {
        args: { locale: 'Français' }
      })
    ).toBe('Nexus utilise maintenant Français.');

    expect(
      service.translate('missing.key', {
        fallback: 'Fallback {value}',
        args: { value: 42 }
      })
    ).toBe('Fallback 42');
  });

  it('notifies listeners when the locale changes and exposes display names', () => {
    const service = new I18nService({
      locale: 'en-US',
      bundles: WORKBENCH_I18N_BUNDLES
    });
    const locales: string[] = [];

    service.onDidChangeLocale(locale => locales.push(locale));

    expect(service.getLocaleDisplayName('fr-FR')).toBe('Français');
    expect(service.setLocale('es-ES')).toBe(true);
    expect(service.getLocale()).toBe('es-ES');
    expect(service.getLocaleDisplayName('en-US')).toBe('Inglés (EE. UU.)');
    expect(locales).toEqual(['es-ES']);
  });

  it('reports missing translations to listeners', () => {
    const service = new I18nService({
      locale: 'en-US'
    });
    const missing: string[] = [];

    service.onMissingTranslation(event => {
      missing.push(`${event.locale}:${event.key}`);
    });

    expect(service.translate('unknown.key', { fallback: 'Unknown' })).toBe('Unknown');
    expect(missing).toEqual(['en-US:unknown.key']);
  });
});
