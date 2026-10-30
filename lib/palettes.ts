/**
 * Colour palettes offered in Admin > Theme. The colour values live in app/globals.css as CSS variables
 * under :root[data-palette="<id>"]. To add a palette: add a block there with the same variables, then an entry here.
 */
export interface PaletteOption {
  id: string;
  name: string;
  note: string;
  /** Four swatches for the menu: main, accent, soft, background. */
  swatches: [string, string, string, string];
}

export const PALETTES: PaletteOption[] = [
  { id: 'purple', name: 'Indigo Purple', note: 'Current look, from the sign-in page', swatches: ['#4A3DC0', '#6C5FDC', '#C9C2F8', '#F3F1FD'] },
  { id: 'teal', name: 'Teal & Cream', note: 'Deep teal, cream and coral buttons', swatches: ['#1B7268', '#2A9D8F', '#D2593B', '#F4EDE4'] },
  { id: 'classic', name: 'Classic Blue', note: 'The original blue look', swatches: ['#0066CC', '#2997FF', '#BFDBFE', '#FBFBFD'] },
];

export const DEFAULT_PALETTE = 'purple';
export const PALETTE_KEY = 'iplanet-palette';

/** Runs in <head> before the page paints, so the saved palette never flashes the default one. */
export const PALETTE_BOOT_SCRIPT = `try{var p=localStorage.getItem('${PALETTE_KEY}');if(p&&/^[a-z0-9-]+$/.test(p))document.documentElement.setAttribute('data-palette',p)}catch(e){}`;
