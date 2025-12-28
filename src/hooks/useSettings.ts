import { useEffect, useState, useCallback, useRef } from 'react';
import { Settings, SettingsService, AISettings, UserPreferences, TrainingSettings, NotificationSettings } from '@/lib/settings';

/**
 * Hook for managing user settings with database sync
 * Uses SettingsService which handles DB sync and localStorage caching
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settingsService = SettingsService.getInstance();
  const initAttempted = useRef(false);

  // Load settings on mount - waits for DB initialization
  useEffect(() => {
    const loadSettings = async () => {
      // Prevent multiple init attempts
      if (initAttempted.current) return;
      initAttempted.current = true;

      try {
        setIsLoading(true);
        setError(null);

        // Ensure settings are initialized from DB first
        if (!settingsService.isInitialized()) {
          await settingsService.initializeFromDB();
        }

        // Now get settings from cache (localStorage)
        const currentSettings = settingsService.getSettings();
        setSettings(currentSettings);
        setIsInitialized(true);
      } catch (err) {
        console.error('[useSettings] Error loading settings:', err);
        // Fallback to localStorage even on error
        const localSettings = settingsService.getSettings();
        setSettings(localSettings);
        setError('Failed to sync settings from server');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [settingsService]);

  // Refresh settings from service (useful after external changes)
  const refreshSettings = useCallback(() => {
    const currentSettings = settingsService.getSettings();
    setSettings(currentSettings);
  }, [settingsService]);

  // Update full settings object
  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    try {
      setError(null);

      // Get current settings and merge updates
      const currentSettings = settingsService.getSettings();
      const newSettings: Settings = {
        ...currentSettings,
        ...updates,
        updatedAt: new Date()
      };

      // Update each category that was changed
      if (updates.userPreferences) {
        settingsService.updateUserPreferences(updates.userPreferences);
      }
      if (updates.dataManagement) {
        settingsService.updateDataManagement(updates.dataManagement);
      }
      if (updates.trainingSettings) {
        settingsService.updateTrainingSettings(updates.trainingSettings);
      }
      if (updates.notificationSettings) {
        settingsService.updateNotificationSettings(updates.notificationSettings);
      }
      if (updates.privacySettings) {
        settingsService.updatePrivacySettings(updates.privacySettings);
      }
      if (updates.aiSettings) {
        settingsService.updateAISettings(updates.aiSettings);
      }

      // Update local state
      setSettings(settingsService.getSettings());
    } catch (err) {
      console.error('[useSettings] Error updating settings:', err);
      setError('Failed to update settings');
    }
  }, [settingsService]);

  // Update AI settings specifically
  const updateAISettings = useCallback((updates: Partial<AISettings>) => {
    try {
      setError(null);
      settingsService.updateAISettings(updates);
      setSettings(settingsService.getSettings());
    } catch (err) {
      console.error('[useSettings] Error updating AI settings:', err);
      setError('Failed to update AI settings');
    }
  }, [settingsService]);

  // Update user preferences
  const updateUserPreferences = useCallback((updates: Partial<UserPreferences>) => {
    try {
      setError(null);
      settingsService.updateUserPreferences(updates);
      setSettings(settingsService.getSettings());
    } catch (err) {
      console.error('[useSettings] Error updating user preferences:', err);
      setError('Failed to update user preferences');
    }
  }, [settingsService]);

  // Update training settings
  const updateTrainingSettings = useCallback((updates: Partial<TrainingSettings>) => {
    try {
      setError(null);
      settingsService.updateTrainingSettings(updates);
      setSettings(settingsService.getSettings());
    } catch (err) {
      console.error('[useSettings] Error updating training settings:', err);
      setError('Failed to update training settings');
    }
  }, [settingsService]);

  // Update notification settings
  const updateNotificationSettings = useCallback((updates: Partial<NotificationSettings>) => {
    try {
      setError(null);
      settingsService.updateNotificationSettings(updates);
      setSettings(settingsService.getSettings());
    } catch (err) {
      console.error('[useSettings] Error updating notification settings:', err);
      setError('Failed to update notification settings');
    }
  }, [settingsService]);

  return {
    settings,
    isLoading,
    isInitialized,
    error,
    refreshSettings,
    updateSettings,
    updateAISettings,
    updateUserPreferences,
    updateTrainingSettings,
    updateNotificationSettings,
  };
}
