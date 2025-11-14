// Settings types and interfaces
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  units: 'metric' | 'imperial';
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  language: 'en' | 'es' | 'fr' | 'de';
  timeZone: string;
  defaultChartType: 'line' | 'bar' | 'area';
  animationsEnabled: boolean;
}

export interface DataManagement {
  autoSave: boolean;
  autoSaveInterval: number; // minutes
  exportFormat: 'json' | 'csv';
  backupEnabled: boolean;
  lastBackup: Date | null;
  storageUsage: {
    sessions: number;
    chatHistory: number;
    trainingPlans: number;
    total: number;
  };
}

export interface TrainingSettings {
  defaultTrainingZones: {
    zone1: { min: number; max: number };
    zone2: { min: number; max: number };
    zone3: { min: number; max: number };
    zone4: { min: number; max: number };
    zone5: { min: number; max: number };
  };
  preferredMetrics: ('pace' | 'power' | 'strokeRate' | 'heartRate')[];
  weeklyGoal: {
    type: 'sessions' | 'distance' | 'duration';
    target: number;
  };
  restDayAlerts: boolean;
  adaptationEnabled: boolean;
}

export interface NotificationSettings {
  sessionReminders: boolean;
  weeklyProgress: boolean;
  achievementAlerts: boolean;
  planReminders: boolean;
  adherenceAlerts: boolean;
  emailNotifications: {
    enabled: boolean;
    address: string;
    frequency: 'daily' | 'weekly' | 'monthly';
  };
}

export interface PrivacySettings {
  dataSharing: boolean;
  analyticsEnabled: boolean;
  crashReports: boolean;
  localStorageOnly: boolean;
  sessionRetention: number; // days
  chatRetention: number; // days
}

export interface AISettings {
  openaiApiKey: string;
  cloudAIEnabled: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  chatSystemPrompt: string;
  planGenerationPrompt: string;
}

export interface Settings {
  userPreferences: UserPreferences;
  dataManagement: DataManagement;
  trainingSettings: TrainingSettings;
  notificationSettings: NotificationSettings;
  privacySettings: PrivacySettings;
  aiSettings: AISettings;
  version: string; // For migration purposes
  updatedAt: Date;
}

export class SettingsService {
  private static instance: SettingsService;
  private readonly STORAGE_KEY = 'rowing_app_settings';
  private readonly CURRENT_VERSION = '1.0.0';
  
  private defaultSettings: Settings = {
    userPreferences: {
      theme: 'system',
      units: 'metric',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      language: 'en',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      defaultChartType: 'line',
      animationsEnabled: true
    },
    dataManagement: {
      autoSave: true,
      autoSaveInterval: 5,
      exportFormat: 'json',
      backupEnabled: false,
      lastBackup: null,
      storageUsage: {
        sessions: 0,
        chatHistory: 0,
        trainingPlans: 0,
        total: 0
      }
    },
    trainingSettings: {
      defaultTrainingZones: {
        zone1: { min: 0, max: 120 }, // Recovery
        zone2: { min: 120, max: 140 }, // Endurance
        zone3: { min: 140, max: 160 }, // Tempo
        zone4: { min: 160, max: 180 }, // Threshold
        zone5: { min: 180, max: 999 } // Max
      },
      preferredMetrics: ['pace', 'power'],
      weeklyGoal: {
        type: 'sessions',
        target: 3
      },
      restDayAlerts: true,
      adaptationEnabled: true
    },
    notificationSettings: {
      sessionReminders: false,
      weeklyProgress: true,
      achievementAlerts: true,
      planReminders: true,
      adherenceAlerts: true,
      emailNotifications: {
        enabled: false,
        address: '',
        frequency: 'weekly'
      }
    },
    privacySettings: {
      dataSharing: false,
      analyticsEnabled: true,
      crashReports: true,
      localStorageOnly: true,
      sessionRetention: 365,
      chatRetention: 90
    },
    aiSettings: {
      openaiApiKey: '',
      cloudAIEnabled: false,
      model: 'gpt-4o', // Updated to latest default model
      temperature: 0.7,
      maxTokens: 1500,
      systemPrompt: 'You are an expert rowing coach and sports scientist...',
      chatSystemPrompt: 'You are a personal AI rowing coach...',
      planGenerationPrompt: 'You are an expert rowing coach specializing in training plan design...'
    },
    version: this.CURRENT_VERSION,
    updatedAt: new Date()
  };

  private constructor() {}
  
  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  // Get all settings
  getSettings(): Settings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return { ...this.defaultSettings };
      }
      
      const settings = JSON.parse(stored);
      const migrated = this.migrateSettings(settings);
      this.saveSettings(migrated);
      return migrated;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return { ...this.defaultSettings };
    }
  }

  // Get specific category settings
  getUserPreferences(): UserPreferences {
    return this.getSettings().userPreferences;
  }

  getDataManagement(): DataManagement {
    return this.getSettings().dataManagement;
  }

  getTrainingSettings(): TrainingSettings {
    return this.getSettings().trainingSettings;
  }

  getNotificationSettings(): NotificationSettings {
    return this.getSettings().notificationSettings;
  }

  getPrivacySettings(): PrivacySettings {
    return this.getSettings().privacySettings;
  }

  getAISettings(): AISettings {
    return this.getSettings().aiSettings;
  }

  // Update specific category
  updateUserPreferences(updates: Partial<UserPreferences>): void {
    const settings = this.getSettings();
    settings.userPreferences = { ...settings.userPreferences, ...updates };
    settings.updatedAt = new Date();
    this.saveSettings(settings);
  }

  updateDataManagement(updates: Partial<DataManagement>): void {
    const settings = this.getSettings();
    settings.dataManagement = { ...settings.dataManagement, ...updates };
    settings.updatedAt = new Date();
    this.saveSettings(settings);
  }

  updateTrainingSettings(updates: Partial<TrainingSettings>): void {
    const settings = this.getSettings();
    settings.trainingSettings = { ...settings.trainingSettings, ...updates };
    settings.updatedAt = new Date();
    this.saveSettings(settings);
  }

  updateNotificationSettings(updates: Partial<NotificationSettings>): void {
    const settings = this.getSettings();
    settings.notificationSettings = { ...settings.notificationSettings, ...updates };
    settings.updatedAt = new Date();
    this.saveSettings(settings);
  }

  updatePrivacySettings(updates: Partial<PrivacySettings>): void {
    const settings = this.getSettings();
    settings.privacySettings = { ...settings.privacySettings, ...updates };
    settings.updatedAt = new Date();
    this.saveSettings(settings);
  }

  updateAISettings(updates: Partial<AISettings>): void {
    const settings = this.getSettings();
    settings.aiSettings = { ...settings.aiSettings, ...updates };
    settings.updatedAt = new Date();
    this.saveSettings(settings);
  }

  // Reset settings
  resetCategory(category: keyof Omit<Settings, 'version' | 'updatedAt'>): void {
    const settings = this.getSettings();
    settings[category] = { ...this.defaultSettings[category] } as any;
    settings.updatedAt = new Date();
    this.saveSettings(settings);
  }

  resetAllSettings(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Export/Import settings
  exportSettings(): string {
    const settings = this.getSettings();
    return JSON.stringify(settings, null, 2);
  }

  importSettings(settingsJson: string): { success: boolean; error?: string } {
    try {
      const importedSettings = JSON.parse(settingsJson);
      
      // Validate settings structure
      if (!this.validateSettings(importedSettings)) {
        return { success: false, error: 'Invalid settings format' };
      }

      const migrated = this.migrateSettings(importedSettings);
      this.saveSettings(migrated);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to import settings' };
    }
  }

  // Storage management
  calculateStorageUsage(): DataManagement['storageUsage'] {
    try {
      const sessions = localStorage.getItem('rowing_sessions');
      const chatHistory = localStorage.getItem('rowing_ai_chat_sessions');
      const trainingPlans = localStorage.getItem('rowing_training_plans');
      const settings = localStorage.getItem(this.STORAGE_KEY);

      const usage = {
        sessions: sessions ? new Blob([sessions]).size : 0,
        chatHistory: chatHistory ? new Blob([chatHistory]).size : 0,
        trainingPlans: trainingPlans ? new Blob([trainingPlans]).size : 0,
        total: 0
      };

      usage.total = usage.sessions + usage.chatHistory + usage.trainingPlans + 
                   (settings ? new Blob([settings]).size : 0);

      return usage;
    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
      return {
        sessions: 0,
        chatHistory: 0,
        trainingPlans: 0,
        total: 0
      };
    }
  }

  // Clear data
  clearDataCategory(category: 'sessions' | 'chatHistory' | 'trainingPlans'): void {
    switch (category) {
      case 'sessions':
        localStorage.removeItem('rowing_sessions');
        break;
      case 'chatHistory':
        localStorage.removeItem('rowing_ai_chat_sessions');
        localStorage.removeItem('rowing_ai_current_session');
        break;
      case 'trainingPlans':
        localStorage.removeItem('rowing_training_plans');
        localStorage.removeItem('rowing_active_training_plan');
        break;
    }
  }

  clearAllData(): void {
    // Clear all app-specific localStorage items
    const keysToRemove = [
      'rowing_sessions',
      'rowing_ai_chat_sessions',
      'rowing_ai_current_session',
      'rowing_training_plans',
      'rowing_active_training_plan',
      this.STORAGE_KEY
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  // Private helper methods
  private saveSettings(settings: Settings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  private migrateSettings(settings: any): Settings {
    // Handle future settings migrations here
    if (!settings.version || settings.version !== this.CURRENT_VERSION) {
      // Apply migration logic based on version - deep merge to ensure all properties exist
      return {
        userPreferences: { ...this.defaultSettings.userPreferences, ...settings.userPreferences },
        dataManagement: { ...this.defaultSettings.dataManagement, ...settings.dataManagement },
        trainingSettings: { ...this.defaultSettings.trainingSettings, ...settings.trainingSettings },
        notificationSettings: { ...this.defaultSettings.notificationSettings, ...settings.notificationSettings },
        privacySettings: { ...this.defaultSettings.privacySettings, ...settings.privacySettings },
        aiSettings: { ...this.defaultSettings.aiSettings, ...settings.aiSettings },
        version: this.CURRENT_VERSION,
        updatedAt: new Date()
      };
    }

    // Even for same version, ensure aiSettings exists (for backward compatibility)
    if (!settings.aiSettings) {
      return {
        ...settings,
        aiSettings: { ...this.defaultSettings.aiSettings }
      };
    }

    return settings;
  }

  private validateSettings(settings: any): boolean {
    try {
      // Basic structure validation
      const requiredKeys = ['userPreferences', 'dataManagement', 'trainingSettings', 
                           'notificationSettings', 'privacySettings', 'aiSettings'];
      
      return requiredKeys.every(key => key in settings);
    } catch (error) {
      return false;
    }
  }

  // Utility methods
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getAvailableTimeZones(): Array<{ value: string; label: string }> {
    return Intl.supportedValuesOf('timeZone').map(tz => ({
      value: tz,
      label: tz.replace(/_/g, ' ')
    }));
  }

  getAvailableLanguages(): Array<{ value: string; label: string }> {
    return [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Español' },
      { value: 'fr', label: 'Français' },
      { value: 'de', label: 'Deutsch' }
    ];
  }
}

// Export singleton instance
export const settings = SettingsService.getInstance();
