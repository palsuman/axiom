export interface AngularCommandPaletteModel {
  open: boolean;
  title: string;
  hint: string;
}

export const INITIAL_ANGULAR_COMMAND_PALETTE_MODEL: AngularCommandPaletteModel = {
  open: false,
  title: 'Command Palette',
  hint: 'Angular host command routing is active.'
};
