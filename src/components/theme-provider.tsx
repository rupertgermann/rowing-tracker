'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { settings } from '@/lib/settings';

function ThemeSettingsSync() {
  const { setTheme } = useTheme();

  React.useEffect(() => {
    const applyThemeFromSettings = () => {
      const userTheme = settings.getUserPreferences().theme;
      setTheme(userTheme);
    };

    applyThemeFromSettings();

    const handleSettingsUpdated = () => {
      applyThemeFromSettings();
    };

    window.addEventListener('rowing_app_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('rowing_app_settings_updated', handleSettingsUpdated);
  }, [setTheme]);

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
