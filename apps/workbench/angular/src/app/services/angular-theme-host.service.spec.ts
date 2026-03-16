import { AngularThemeHostService } from './angular-theme-host.service';

describe('AngularThemeHostService', () => {
  it('applies the default shared dark theme runtime tokens', () => {
    const service = new AngularThemeHostService();
    const documentRef = document.implementation.createHTMLDocument('theme');

    service.initialize(documentRef);

    expect(documentRef.documentElement.getAttribute('data-nexus-theme')).toBe('Nexus Dark');
    expect(documentRef.documentElement.getAttribute('data-nexus-theme-kind')).toBe('dark');
    expect(documentRef.documentElement.style.getPropertyValue('--nexus-text')).toBe('#cccccc');
    expect(documentRef.documentElement.style.getPropertyValue('--nexus-icon-size-md')).toBe('16px');
  });

  it('toggles to the light theme', () => {
    const service = new AngularThemeHostService();
    const documentRef = document.implementation.createHTMLDocument('theme');

    service.initialize(documentRef);
    service.toggleTheme();

    expect(documentRef.documentElement.getAttribute('data-nexus-theme')).toBe('Nexus Light');
    expect(documentRef.documentElement.getAttribute('data-nexus-theme-kind')).toBe('light');
    expect(documentRef.documentElement.style.getPropertyValue('--nexus-text')).toBe('#24292f');
  });
});
