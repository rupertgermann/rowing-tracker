'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { settings } from '@/lib/settings';

function ThemeSettingsSync() {
  const { setTheme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    const applySettingsFromStorage = () => {
      const prefs = settings.getUserPreferences();
      setTheme(prefs.theme);
      applyBrightness(prefs.lightModeBrightness);
    };

    const applyBrightness = (brightness: number) => {
      // Only apply brightness adjustment in light mode
      // brightness: 100 = full bright (default), 0 = most dimmed
      const dimFactor = brightness / 100; // 1.0 = no change, 0 = max dimming
      document.documentElement.style.setProperty('--brightness-factor', dimFactor.toString());
    };

    applySettingsFromStorage();

    const handleSettingsUpdated = () => {
      applySettingsFromStorage();
    };

    window.addEventListener('rowing_app_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('rowing_app_settings_updated', handleSettingsUpdated);
  }, [setTheme]);

  // Re-apply brightness when theme changes
  React.useEffect(() => {
    const prefs = settings.getUserPreferences();
    const dimFactor = prefs.lightModeBrightness / 100;
    document.documentElement.style.setProperty('--brightness-factor', dimFactor.toString());
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeSettingsSync />
      {children}
    </NextThemesProvider>
  );
}
