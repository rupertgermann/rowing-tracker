// Color palette options for achievement certificate images

export interface ColorPalette {
  value: 'classic' | 'gold-blue' | 'emerald' | 'royal' | 'sunset' | 'monochrome' | 'ocean';
  label: string;
  description: string;
  colors: string[]; // Hex colors for preview
  prompt: string; // Color description for AI prompt
}

export const ACHIEVEMENT_COLOR_PALETTES: ColorPalette[] = [
  {
    value: 'classic',
    label: 'Classic Gold & Blue',
    description: 'Traditional achievement colors with deep blues and golds',
    colors: ['#1e3a8a', '#fbbf24', '#ffffff'],
    prompt: 'deep blues, golds, and whites'
  },
  {
    value: 'gold-blue',
    label: 'Elegant Gold & Navy',
    description: 'Sophisticated navy blue with rich gold accents',
    colors: ['#0f172a', '#d97706', '#f8fafc'],
    prompt: 'navy blue, rich gold, and cream'
  },
  {
    value: 'emerald',
    label: 'Emerald & Gold',
    description: 'Vibrant emerald green with warm gold highlights',
    colors: ['#047857', '#fbbf24', '#ecfdf5'],
    prompt: 'emerald green, gold, and mint'
  },
  {
    value: 'royal',
    label: 'Royal Purple',
    description: 'Regal purple with silver and white accents',
    colors: ['#6b21a8', '#94a3b8', '#ffffff'],
    prompt: 'royal purple, silver, and white'
  },
  {
    value: 'sunset',
    label: 'Sunset Orange',
    description: 'Warm sunset colors with orange, coral, and gold',
    colors: ['#ea580c', '#fb923c', '#fef3c7'],
    prompt: 'sunset orange, coral, and golden yellow'
  },
  {
    value: 'monochrome',
    label: 'Monochrome Elite',
    description: 'Sophisticated black, white, and gray tones',
    colors: ['#0f172a', '#64748b', '#f1f5f9'],
    prompt: 'black, charcoal gray, and white'
  },
  {
    value: 'ocean',
    label: 'Ocean Blue',
    description: 'Cool ocean blues with aqua and white highlights',
    colors: ['#0369a1', '#06b6d4', '#e0f2fe'],
    prompt: 'deep ocean blue, aqua, and sky blue'
  }
];

export function getColorPalettePrompt(colorValue: string): string {
  const palette = ACHIEVEMENT_COLOR_PALETTES.find(p => p.value === colorValue);
  return palette?.prompt || 'deep blues, golds, and whites';
}
