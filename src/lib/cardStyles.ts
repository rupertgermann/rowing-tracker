// Centralized card styling for records and achievements sections
export const cardStyles = {
  // Glow shadow settings - adjust these to change glow appearance for ALL themes
  // Format: shadow-[y-offset_blur_spread_rgba(r,g,b,opacity)]
  shadowBase: '0_20px_45px_-25px',      // y-offset, blur, spread for base state
  shadowHover: '0_25px_50px_-20px',     // y-offset, blur, spread for hover state
  glowOpacity: 0.7,                      // base glow opacity
  glowHoverOpacity: 0.9,                 // hover glow opacity
  
  // Color themes for different sections
  gold: {
    border: 'border-gold-200/40',
    bg: 'bg-gradient-to-br from-gold-50/60 via-background to-transparent dark:from-gold-950/20',
    glowColor: '212,175,55',  // RGB for gold
    titleColor: 'text-gold-700 dark:text-gold-400',
    iconColor: 'text-gold-500',
    accentColor: 'text-gold-500',
    badge: 'bg-gradient-to-r from-gold-400 to-amber-500 text-gold-950 text-xs border border-gold-500 shadow-sm',
  },
  amber: {
    border: 'border-amber-500/30',
    bg: 'bg-gradient-to-br from-amber-50/60 via-background to-transparent dark:from-amber-950/20',
    glowColor: '245,158,11',  // RGB for amber
    titleColor: 'text-amber-700 dark:text-amber-400',
    iconColor: 'text-amber-500',
    accentColor: 'text-amber-500',
  },
  teal: {
    border: 'border-teal-500/30',
    bg: 'bg-gradient-to-br from-teal-50/60 via-background to-transparent dark:from-teal-950/20',
    glowColor: '20,184,166',  // RGB for teal
    titleColor: 'text-teal-700 dark:text-teal-400',
    iconColor: 'text-teal-500',
    accentColor: 'text-teal-500',
  },
  purple: {
    border: 'border-purple-500/30',
    bg: 'bg-gradient-to-br from-purple-50/60 via-background to-transparent dark:from-purple-950/20',
    glowColor: '168,85,247',  // RGB for purple
    titleColor: 'text-purple-700 dark:text-purple-400',
    iconColor: 'text-purple-500',
    accentColor: 'text-purple-500',
  },
  // Common styles
  base: 'relative overflow-hidden h-full',
  clickable: 'cursor-pointer transition-all hover:scale-[1.02]',
} as const;

export type CardTheme = 'gold' | 'amber' | 'teal' | 'purple';

// Helper to build shadow class from centralized settings
export const getShadowClass = (theme: CardTheme) => {
  const color = cardStyles[theme].glowColor;
  return `shadow-[${cardStyles.shadowBase}_rgba(${color},${cardStyles.glowOpacity})]`;
};

export const getHoverShadowClass = (theme: CardTheme) => {
  const color = cardStyles[theme].glowColor;
  return `hover:shadow-[${cardStyles.shadowHover}_rgba(${color},${cardStyles.glowHoverOpacity})]`;
};

// Helper to build card className
export const getCardClassName = (theme: CardTheme, isClickable: boolean = false) => {
  const t = cardStyles[theme];
  const shadow = getShadowClass(theme);
  const hoverShadow = getHoverShadowClass(theme);
  return `${cardStyles.base} ${t.border} ${t.bg} ${shadow} ${isClickable ? `${cardStyles.clickable} ${hoverShadow}` : ''}`;
};
