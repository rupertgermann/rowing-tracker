import { useEffect, useState, useCallback } from 'react';
import { Settings, SettingsService } from '@/lib/settings';
import { fetchSettingsFromDB, saveSettingsToDB } from '@/lib/settingsSync';

/**
 * Hook for managing user settings with database sync
 * Falls back to localStorage if database is unavailable
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const settingsService = SettingsService.getInstance();

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Try to fetch from database first
        const dbSettings = await fetchSettingsFromDB();
        
        if (dbSettings) {
          setSettings(dbSettings as Settings);
        } else {
          // Fallback to localStorage
          const localSettings = settingsService.getSettings();
          setSettings(localSettings);
        }
      } catch (err) {
        console.error('Error loading settings:', err);
        // Fallback to localStorage on error
        const localSettings = settingsService.getSettings();
        setSettings(localSettings);
        setError('Failed to sync settings from server');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Save settings to both database and localStorage
  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    try {
      setError(null);
      
      // Update local state immediately for better UX
      setSettings(prev => prev ? { ...prev, ...updates } : null);

      // Save to database asynchronously
      const success = await saveSettingsToDB(updates);
      if (!success) {
        setError('Failed to save settings to server');
      }
    } catch (err) {
      console.error('Error updating settings:', err);
      setError('Failed to update settings');
    }
  }, []);

  // Update specific category
  const updateAISettings = useCallback(async (updates: Partial<Settings['aiSettings']>) => {
    if (!settings) return;
    
    const newAISettings = { ...settings.aiSettings, ...updates };
    await updateSettings({ ...settings, aiSettings: newAISettings });
  }, [settings, updateSettings]);

  const updateUserPreferences = useCallback(async (updates: Partial<Settings['userPreferences']>) => {
    if (!settings) return;
    
    const newPreferences = { ...settings.userPreferences, ...updates };
    await updateSettings({ ...settings, userPreferences: newPreferences });
  }, [settings, updateSettings]);

  const updateTrainingSettings = useCallback(async (updates: Partial<Settings['trainingSettings']>) => {
    if (!settings) return;
    
    const newTrainingSettings = { ...settings.trainingSettings, ...updates };
    await updateSettings({ ...settings, trainingSettings: newTrainingSettings });
  }, [settings, updateSettings]);

  const updateNotificationSettings = useCallback(async (updates: Partial<Settings['notificationSettings']>) => {
    if (!settings) return;
    
    const newNotificationSettings = { ...settings.notificationSettings, ...updates };
    await updateSettings({ ...settings, notificationSettings: newNotificationSettings });
  }, [settings, updateSettings]);

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    updateAISettings,
    updateUserPreferences,
    updateTrainingSettings,
    updateNotificationSettings,
  };
}
