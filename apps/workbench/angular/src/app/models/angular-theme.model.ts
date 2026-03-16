import type { AngularThemeId } from '../types/angular-theme-id';

export interface AngularThemeModel {
  id: AngularThemeId;
  label: string;
  colorScheme: 'dark' | 'light';
}

export const ANGULAR_THEME_MODELS: Record<AngularThemeId, AngularThemeModel> = {
  'Nexus Dark': {
    id: 'Nexus Dark',
    label: 'Nexus Dark',
    colorScheme: 'dark'
  },
  'Nexus Light': {
    id: 'Nexus Light',
    label: 'Nexus Light',
    colorScheme: 'light'
  },
  'Nexus High Contrast': {
    id: 'Nexus High Contrast',
    label: 'Nexus High Contrast',
    colorScheme: 'dark'
  }
};
