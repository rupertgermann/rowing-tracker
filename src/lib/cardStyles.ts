// Centralized card styling for records and achievements sections
export const cardStyles = {
  // Glow shadow settings - adjust these to change glow appearance for ALL themes
  glow: {
    // Base state shadow geometry
    yOffset: 0,
    blur: 45,
    spread: -25,
    opacity: 0.7,
    // Hover state shadow geometry  
    hoverYOffset: 0,
    hoverBlur: 50,
    hoverSpread: -20,
    hoverOpacity: 0.9,
  },
  
  // Color themes for different sections (RGB values)
  gold: {
    border: 'border-gold-200/40',
    bg: 'bg-gradient-to-br from-gold-50/60 via-background to-transparent dark:from-gold-950/20',
    glowColor: { r: 212, g: 175, b: 55 },
    titleColor: 'text-gold-700 dark:text-gold-400',
    iconColor: 'text-gold-500',
    accentColor: 'text-gold-500',
    badge: 'bg-gradient-to-r from-gold-400 to-amber-500 text-gold-950 text-xs border border-gold-500 shadow-sm',
  },
  amber: {
    border: 'border-amber-500/30',
    bg: 'bg-gradient-to-br from-amber-50/60 via-background to-transparent dark:from-amber-950/20',
    glowColor: { r: 245, g: 158, b: 11 },
    titleColor: 'text-amber-700 dark:text-amber-400',
    iconColor: 'text-amber-500',
    accentColor: 'text-amber-500',
  },
  teal: {
    border: 'border-teal-500/30',
    bg: 'bg-gradient-to-br from-teal-50/60 via-background to-transparent dark:from-teal-950/20',
    glowColor: { r: 20, g: 184, b: 166 },
    titleColor: 'text-teal-700 dark:text-teal-400',
    iconColor: 'text-teal-500',
    accentColor: 'text-teal-500',
  },
  purple: {
    border: 'border-purple-500/30',
    bg: 'bg-gradient-to-br from-purple-50/60 via-background to-transparent dark:from-purple-950/20',
    glowColor: { r: 168, g: 85, b: 247 },
    titleColor: 'text-purple-700 dark:text-purple-400',
    iconColor: 'text-purple-500',
    accentColor: 'text-purple-500',
  },
  // Common styles
  base: 'relative overflow-hidden h-full',
  clickable: 'cursor-pointer transition-all hover:scale-[1.02]',
} as const;

export type CardTheme = 'gold' | 'amber' | 'teal' | 'purple';

// Helper to build inline shadow style (works with any opacity value)
export const getShadowStyle = (theme: CardTheme): React.CSSProperties => {
  const { r, g, b } = cardStyles[theme].glowColor;
  const { yOffset, blur, spread, opacity } = cardStyles.glow;
  return {
    boxShadow: `0 ${yOffset}px ${blur}px ${spread}px rgba(${r}, ${g}, ${b}, ${opacity})`,
  };
};

export const getHoverShadowStyle = (theme: CardTheme): React.CSSProperties => {
  const { r, g, b } = cardStyles[theme].glowColor;
  const { hoverYOffset, hoverBlur, hoverSpread, hoverOpacity } = cardStyles.glow;
  return {
    boxShadow: `0 ${hoverYOffset}px ${hoverBlur}px ${hoverSpread}px rgba(${r}, ${g}, ${b}, ${hoverOpacity})`,
  };
};

// Helper to build card className (without shadow - shadow applied via style prop)
export const getCardClassName = (theme: CardTheme, isClickable: boolean = false) => {
  const t = cardStyles[theme];
  return `${cardStyles.base} ${t.border} ${t.bg} ${isClickable ? cardStyles.clickable : ''}`;
};
