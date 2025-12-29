import { DEFAULT_AWARD_SUGGESTIONS_PROMPT } from '@/lib/aiPromptDefaults';

// Settings types and interfaces
// VERSION: 2024-12-27-v2 - Added auth check before DB sync
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  lightModeBrightness: number; // 0-100, controls light mode brightness (100 = default bright, 0 = dimmed)
  units: 'metric' | 'imperial';
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  language: 'en' | 'es' | 'fr' | 'de';
  timeZone: string;
  defaultChartType: 'line' | 'bar' | 'area';
  animationsEnabled: boolean;
  showPromptSuggestions: boolean;
  customPrompts: string[];
}

export interface DataManagement {
  exportFormat: 'json' | 'csv';
  backupEnabled: boolean;
  lastBackup: Date | null;
  storageUsage: {
    sessions: number;
    chatHistory: number;
    trainingPlans: number;
    insightsArchive: number;
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

export interface UseCaseConfig {
  reasoning: 'none' | 'low' | 'medium' | 'high';
  verbosity: 'low' | 'medium' | 'high';
  model: 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.1' | 'gpt-5.2';
}

export interface AISettings {
  cloudAIEnabled: boolean;
  openaiApiKey: string;
  maxTokens: number;

  // Per-use-case configuration
  chat: UseCaseConfig;
  insights: UseCaseConfig;
  trainingPlans: UseCaseConfig;
  awardSuggestions: UseCaseConfig;
  systemPrompt: string;
  chatSystemPrompt: string;
  planGenerationPrompt: string;
  insightsPrompt: string;
  explainChartPrompt: string; // System prompt for chart explanations

  awardSuggestionsPrompt: string; // System prompt for award suggestion generation

  // Achievement generator prompts
  achievementStoryPrompt: string; // System prompt for achievement story generation
  achievementImagePrompt: string; // Prompt template for achievement image generation
  achievementText: UseCaseConfig; // Text/story generation configuration
  achievementImageModel: 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5'; // Image model selection
  achievementImageQuality: 'auto' | 'high' | 'medium' | 'low'; // gpt-image-1 quality settings
  achievementImageSize: '1024x1024' | '1024x1536' | '1536x1024' | 'auto'; // image size
  achievementImageColors: 'classic' | 'gold-blue' | 'emerald' | 'royal' | 'sunset' | 'monochrome' | 'ocean'; // color palette

  // Personal context for AI personalization
  userProfileContext: string; // Condensed system prompt addition from user docs/self-description
  userProfileRawInput: string; // Original user input (for editing)
  userProfileGeneration: UseCaseConfig; // Model/reasoning config for context generation
  userProfilePrompt: string; // Prompt for condensing user profile
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
  private readonly CURRENT_VERSION = '1.4.0'; // Condensed explainChartPrompt - max 6 lines per section
  private dbInitialized = false;
  private initPromise: Promise<void> | null = null;
  private syncTimeout: NodeJS.Timeout | null = null;
  private lastSyncedData: string = '';

  private defaultSettings: Settings = {
    userPreferences: {
      theme: 'system',
      lightModeBrightness: 100, // Default to full brightness
      units: 'metric',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '24h',
      language: 'en',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      defaultChartType: 'line',
      animationsEnabled: true,
      showPromptSuggestions: true,
      customPrompts: []
    },
    dataManagement: {
      exportFormat: 'json',
      backupEnabled: false,
      lastBackup: null,
      storageUsage: {
        sessions: 0,
        chatHistory: 0,
        trainingPlans: 0,
        insightsArchive: 0,
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
      maxTokens: 4000,

      // Per-use-case configurations with smart defaults
      chat: {
        reasoning: 'none',          // Ultra-fast responses (compatible with all models)
        verbosity: 'medium',       // Natural conversation
        model: 'gpt-5-mini'        // Good balance of speed and quality
      },
      insights: {
        reasoning: 'medium',      // Good quality/speed ratio
        verbosity: 'low',         // Concise insights
        model: 'gpt-5-mini'       // Efficient for analysis tasks
      },
      trainingPlans: {
        reasoning: 'high',        // Maximum reasoning
        verbosity: 'high',        // Detailed explanations
        model: 'gpt-5.1'          // Best quality for complex plans
      },
      awardSuggestions: {
        reasoning: 'medium',
        verbosity: 'low',
        model: 'gpt-5-mini'
      },
      systemPrompt: 'You are an expert rowing coach and sports scientist...',
      chatSystemPrompt: 'You are a personal AI rowing coach...',
      planGenerationPrompt: 'You are an expert rowing coach specializing in training plan design...',
      insightsPrompt: `Analyze the following indoor rowing workout data and provide personalized insights:

SESSION DATA:
{sessionData}

ANALYSIS REQUIREMENTS:
1. Performance Trends: Analyze pace, power, and stroke rate patterns
2. Training Load: Assess volume and intensity balance
3. Recovery Needs: Identify signs of overtraining or under-recovery
4. Technique Indicators: Look for efficiency patterns
5. Goal Progress: Evaluate progress toward typical rowing goals

RESPONSE FORMAT:
Return a JSON array of insights with this structure:
[
  {
    "type": "performance|recommendation|trend|achievement|warning",
    "title": "Brief insight title",
    "description": "Detailed explanation with specific advice",
    "actionable": true/false,
    "priority": "high|medium|low", 
    "confidence": 0.0-1.0,
    "evidence": ["specific data points supporting this insight"]
  }
]

Limit to 5 most important insights. Focus on actionable advice that will help the rower improve.`,

      explainChartPrompt: `Structure your response as follows:

## Why This Chart Matters
2-3 sentences: What does this chart type show and WHY is it useful? What question does it answer?

## What I See In Your Data 🔍
Max 6 lines. Key patterns, trends, improvements or concerns in MY data. Be specific and concise.

## What This Means For You 🎯
Max 6 lines. Benchmarks comparison + 1-2 actionable suggestions.

Be brief and direct. No fluff.`,

      awardSuggestionsPrompt: DEFAULT_AWARD_SUGGESTIONS_PROMPT,

      // Achievement generator (defaults)
      achievementText: { reasoning: 'low', verbosity: 'medium', model: 'gpt-5-mini' },
      achievementImageModel: 'gpt-image-1',
      achievementImageQuality: 'auto',
      achievementImageSize: '1024x1024',
      achievementImageColors: 'classic',

      // Achievement generator prompts
      achievementStoryPrompt: `You are a creative writer crafting inspiring achievement stories for rowers. 
Write a short, motivational story (2-3 paragraphs, ~150-200 words) celebrating a rowing achievement.

The story should:
- Be personal and emotionally engaging
- Reference the specific achievement and what it represents
- Include vivid imagery related to rowing (water, oars, rhythm, power)
- End with an inspiring message about the journey ahead
- Be written in second person ("You have...")

Achievement Details:
Title: {title}
Description: {description}
Earned On: {earnedAt}

Write the achievement story:`,

      achievementImagePrompt: `Create a stunning, celebratory achievement certificate/card image for a rowing accomplishment.

Achievement: {title}
Description: {description}

Style guidelines:
- Modern, clean design with elegant typography
- Incorporate rowing imagery (stylized oars, water ripples, rowing silhouette)
- (colors)
- Include decorative elements suggesting achievement (laurels, ribbons, stars)
- The image should feel prestigious and celebratory
- Do NOT include any text - the text will be overlaid separately
- High quality, suitable for display`,

      // Personal context defaults
      userProfileContext: '',
      userProfileRawInput: '',
      userProfileGeneration: {
        reasoning: 'low',
        verbosity: 'low',
        model: 'gpt-5-mini'
      },
      userProfilePrompt: `You are helping a rowing coach AI understand a user's personal context. The user has provided information about themselves that should influence how the AI coach gives advice.

USER'S INFORMATION:
{userInput}

YOUR TASK:
Condense this information into a concise, structured system prompt addition (max 300 words) that will help the AI coach personalize its advice. Focus on:

1. **Health/Medical Considerations**: Any conditions, injuries, or limitations that affect training (e.g., heart conditions, joint issues, medications)
2. **Physical Profile**: Age, fitness level, experience, physical constraints
3. **Goals & Preferences**: Training goals, preferred workout types, time availability
4. **Special Needs**: Any accommodations or modifications needed for safe training

FORMAT YOUR RESPONSE AS:
A direct system prompt addition that starts with "PERSONAL CONTEXT:" followed by bullet points. This text will be injected directly into AI prompts, so write it as instructions for an AI, not as a summary for the user.

Example format:
PERSONAL CONTEXT:
- User has [condition], adjust recommendations to [specific guidance]
- Avoid suggesting [specific activities] due to [reason]
- User prefers [preference], incorporate this into plans
- [Any other relevant coaching considerations]

Be specific and actionable. Only include information relevant to rowing training and coaching.`
    },
    version: this.CURRENT_VERSION,
    updatedAt: new Date()
  };

  private constructor() { }

  /**
   * Initialize settings from database (DB-first pattern)
   * This should be called on app load to ensure DB is source of truth
   * localStorage is used only as a synchronous cache after initialization
   */
  async initializeFromDB(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.dbInitialized) {
      return;
    }

    this.initPromise = this._doInitializeFromDB();
    await this.initPromise;
    this.initPromise = null;
  }

  private async _doInitializeFromDB(): Promise<void> {
    // Guard against SSR/non-browser environments
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const response = await fetch('/api/settings');
      
      if (!response.ok) {
        console.warn('[SETTINGS] Failed to fetch from DB, using localStorage');
        this.dbInitialized = true;
        return;
      }

      const data = await response.json();
      const dbSettings = data.settings;

      if (dbSettings) {
        // Get current localStorage settings to preserve sensitive data like API key
        const currentLocalSettings = localStorage.getItem(this.STORAGE_KEY);
        let currentApiKey = '';
        
        if (currentLocalSettings) {
          try {
            const parsed = JSON.parse(currentLocalSettings);
            currentApiKey = parsed.aiSettings?.openaiApiKey || '';
          } catch {
            console.warn('[SETTINGS] Failed to parse current localStorage settings');
          }
        }
        
        // Check if aiConfig is missing achievementImageColors BEFORE transformation
        const dbAiConfig = dbSettings.aiConfig as Record<string, unknown> | null;
        const needsColorFieldMigration = !dbAiConfig?.achievementImageColors;
        
        // Transform DB settings to app format and cache in localStorage
        const appSettings = this.transformDBToAppSettings(dbSettings);
        const migrated = this.migrateSettings(appSettings);
        
        // Preserve API key from localStorage (never stored in DB)
        if (currentApiKey) {
          migrated.aiSettings.openaiApiKey = currentApiKey;
        }
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(migrated));
        
        // If achievementImageColors was missing from DB, trigger a save to populate it
        if (needsColorFieldMigration) {
          // Trigger an immediate sync to add the missing field to the database
          setTimeout(() => this.syncToDatabase(migrated), 100);
        }
      } else {
        // No DB settings, check if we have localStorage settings to sync up
        const localSettings = localStorage.getItem(this.STORAGE_KEY);
        if (localSettings) {
          const parsed = JSON.parse(localSettings);
          await this.syncToDatabase(parsed);
        }
      }

      this.dbInitialized = true;
    } catch (error) {
      console.error('[SETTINGS] Error initializing from database:', error);
      this.dbInitialized = true; // Mark as initialized to prevent retry loops
    }
  }

  /**
   * Transform database settings format to app Settings format
   */
  private transformDBToAppSettings(dbSettings: Record<string, unknown>): Settings {
    return {
      userPreferences: {
        theme: (dbSettings.theme as 'light' | 'dark' | 'system') || 'system',
        lightModeBrightness: (dbSettings.lightModeBrightness as number) ?? 100,
        units: (dbSettings.units as 'metric' | 'imperial') || 'metric',
        dateFormat: (dbSettings.dateFormat as 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD') || 'MM/DD/YYYY',
        timeFormat: (dbSettings.timeFormat as '12h' | '24h') || '24h',
        language: (dbSettings.language as 'en' | 'es' | 'fr' | 'de') || 'en',
        timeZone: (dbSettings.timeZone as string) || Intl.DateTimeFormat().resolvedOptions().timeZone,
        defaultChartType: (dbSettings.defaultChartType as 'line' | 'bar' | 'area') || 'line',
        animationsEnabled: (dbSettings.animationsEnabled as boolean) !== false,
        showPromptSuggestions: (dbSettings.showPromptSuggestions as boolean) !== false,
        customPrompts: (dbSettings.customPrompts as string[]) || []
      },
      dataManagement: {
        ...this.defaultSettings.dataManagement,
        exportFormat: (dbSettings.exportFormat as 'json' | 'csv') || 'json',
        backupEnabled: (dbSettings.backupEnabled as boolean) || false,
        lastBackup: dbSettings.lastBackup ? new Date(dbSettings.lastBackup as string) : null,
      },
      trainingSettings: {
        ...this.defaultSettings.trainingSettings,
        defaultTrainingZones: (dbSettings.trainingZones as {
          zone1: { min: number; max: number };
          zone2: { min: number; max: number };
          zone3: { min: number; max: number };
          zone4: { min: number; max: number };
          zone5: { min: number; max: number };
        }) || this.defaultSettings.trainingSettings.defaultTrainingZones,
        preferredMetrics: (dbSettings.preferredMetrics as ('pace' | 'power' | 'strokeRate' | 'heartRate')[]) || this.defaultSettings.trainingSettings.preferredMetrics,
        weeklyGoal: {
          type: (dbSettings.weeklyGoalType as 'sessions' | 'distance' | 'duration') || 'sessions',
          target: (dbSettings.weeklyGoalTarget as number) || 3
        },
        restDayAlerts: (dbSettings.restDayAlerts as boolean) !== false,
        adaptationEnabled: (dbSettings.adaptationEnabled as boolean) !== false
      },
      notificationSettings: {
        sessionReminders: (dbSettings.sessionReminders as boolean) || false,
        weeklyProgress: (dbSettings.weeklyProgress as boolean) !== false,
        achievementAlerts: (dbSettings.achievementAlerts as boolean) !== false,
        planReminders: (dbSettings.planReminders as boolean) || false,
        adherenceAlerts: (dbSettings.adherenceAlerts as boolean) || false,
        emailNotifications: this.defaultSettings.notificationSettings.emailNotifications
      },
      privacySettings: this.defaultSettings.privacySettings,
      aiSettings: {
        ...this.defaultSettings.aiSettings,
        cloudAIEnabled: (dbSettings.cloudAIEnabled as boolean) || false,
        // Note: openaiApiKey is NOT loaded from DB - it's kept local only
        // Will be preserved from localStorage if present
        maxTokens: (dbSettings.maxTokens as number) || 4000,
        userProfileContext: (dbSettings.userProfileContext as string) || '',
        userProfileRawInput: (dbSettings.userProfileRawInput as string) || '',
        ...(dbSettings.aiConfig as Record<string, unknown> || {}),
        ...(dbSettings.customPromptsAi as Record<string, unknown> || {})
      },
      version: this.CURRENT_VERSION,
      updatedAt: new Date((dbSettings.updatedAt as string) || Date.now())
    };
  }

  /**
   * Sync settings to database (async, non-blocking)
   */
  private async syncToDatabase(settings: Settings): Promise<void> {
    try {
      const dbPayload = this.transformAppToDBSettings(settings);
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbPayload)
      });

      if (!response.ok) {
        // If unauthorized, the API will return 401 and we can skip silently
        if (response.status === 401) {
          return;
        }
        console.error('[SETTINGS] Failed to sync to database');
      }
    } catch (error) {
      console.error('[SETTINGS] Error syncing to database:', error);
    }
  }

  /**
   * Transform app Settings format to database format
   */
  private transformAppToDBSettings(settings: Settings): Record<string, unknown> {
    return {
      theme: settings.userPreferences.theme,
      units: settings.userPreferences.units,
      dateFormat: settings.userPreferences.dateFormat,
      timeFormat: settings.userPreferences.timeFormat,
      language: settings.userPreferences.language,
      timeZone: settings.userPreferences.timeZone,
      defaultChartType: settings.userPreferences.defaultChartType,
      animationsEnabled: settings.userPreferences.animationsEnabled,
      showPromptSuggestions: settings.userPreferences.showPromptSuggestions,
      customPrompts: settings.userPreferences.customPrompts,
      exportFormat: settings.dataManagement.exportFormat,
      backupEnabled: settings.dataManagement.backupEnabled,
      lastBackup: settings.dataManagement.lastBackup,
      trainingZones: settings.trainingSettings.defaultTrainingZones,
      preferredMetrics: settings.trainingSettings.preferredMetrics,
      weeklyGoalType: settings.trainingSettings.weeklyGoal.type,
      weeklyGoalTarget: settings.trainingSettings.weeklyGoal.target,
      restDayAlerts: settings.trainingSettings.restDayAlerts,
      adaptationEnabled: settings.trainingSettings.adaptationEnabled,
      sessionReminders: settings.notificationSettings.sessionReminders,
      weeklyProgress: settings.notificationSettings.weeklyProgress,
      achievementAlerts: settings.notificationSettings.achievementAlerts,
      planReminders: settings.notificationSettings.planReminders,
      adherenceAlerts: settings.notificationSettings.adherenceAlerts,
      cloudAIEnabled: settings.aiSettings.cloudAIEnabled,
      maxTokens: settings.aiSettings.maxTokens,
      userProfileContext: settings.aiSettings.userProfileContext,
      userProfileRawInput: settings.aiSettings.userProfileRawInput,
      aiConfig: {
        chat: settings.aiSettings.chat,
        insights: settings.aiSettings.insights,
        trainingPlans: settings.aiSettings.trainingPlans,
        awardSuggestions: settings.aiSettings.awardSuggestions,
        achievementText: settings.aiSettings.achievementText,
        achievementImageModel: settings.aiSettings.achievementImageModel,
        achievementImageQuality: settings.aiSettings.achievementImageQuality,
        achievementImageSize: settings.aiSettings.achievementImageSize,
        achievementImageColors: settings.aiSettings.achievementImageColors,
        userProfileGeneration: settings.aiSettings.userProfileGeneration
      },
      customPromptsAi: {
        systemPrompt: settings.aiSettings.systemPrompt,
        chatSystemPrompt: settings.aiSettings.chatSystemPrompt,
        planGenerationPrompt: settings.aiSettings.planGenerationPrompt,
        insightsPrompt: settings.aiSettings.insightsPrompt,
        explainChartPrompt: settings.aiSettings.explainChartPrompt,
        awardSuggestionsPrompt: settings.aiSettings.awardSuggestionsPrompt,
        achievementStoryPrompt: settings.aiSettings.achievementStoryPrompt,
        achievementImagePrompt: settings.aiSettings.achievementImagePrompt,
        userProfilePrompt: settings.aiSettings.userProfilePrompt
      }
    };
  }

  /**
   * Check if settings have been initialized from DB
   */
  isInitialized(): boolean {
    return this.dbInitialized;
  }

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  // Get all settings
  getSettings(): Settings {
    try {
      // Guard against SSR/non-browser environments
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return { ...this.defaultSettings };
      }

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
    (settings[category] as unknown) = { ...this.defaultSettings[category] };
    settings.updatedAt = new Date();
    this.saveSettings(settings);
  }

  resetAllSettings(): void {
    // Guard against SSR/non-browser environments
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
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
    } catch {
      return { success: false, error: 'Failed to import settings' };
    }
  }

  // Storage management
  async calculateStorageUsage(): Promise<DataManagement['storageUsage']> {
    try {
      // Guard against SSR/non-browser environments
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return {
          sessions: 0,
          chatHistory: 0,
          trainingPlans: 0,
          insightsArchive: 0,
          total: 0
        };
      }

      // Try to fetch from DB API first
      try {
        const response = await fetch('/api/data-usage');
        if (response.ok) {
          const data = await response.json();
          if (data.usage) {
            return {
              sessions: data.usage.sessions || 0,
              chatHistory: data.usage.chatHistory || 0,
              trainingPlans: data.usage.trainingPlans || 0,
              insightsArchive: data.usage.insightsArchive || 0,
              total: data.usage.total || 0
            };
          }
        }
      } catch {
        console.warn('[SETTINGS] Failed to fetch storage usage from API, falling back to local calculation');
      }

      // Fallback to local calculation for remaining localStorage items
      const rowingStore = localStorage.getItem('rowing-tracker-storage');
      const settings = localStorage.getItem(this.STORAGE_KEY);
      
      let sessionsSize = 0;
      if (rowingStore) {
        try {
          const storeData = JSON.parse(rowingStore);
          if (storeData.state?.sessions) {
            sessionsSize = new Blob([JSON.stringify(storeData.state.sessions)]).size;
          }
        } catch (e) {
          console.error('Error parsing rowing store:', e);
        }
      }

      const usage = {
        sessions: sessionsSize,
        chatHistory: 0,
        trainingPlans: 0,
        insightsArchive: 0,
        total: 0
      };

      usage.total = usage.sessions + (settings ? new Blob([settings]).size : 0);

      return usage;
    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
      return {
        sessions: 0,
        chatHistory: 0,
        trainingPlans: 0,
        insightsArchive: 0,
        total: 0
      };
    }
  }

  // Clear data
  clearDataCategory(category: 'sessions' | 'chatHistory' | 'trainingPlans'): void {
    // Guard against SSR/non-browser environments
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    switch (category) {
      case 'sessions':
        // Sessions are stored in Zustand store ('rowing-tracker-storage')
        // The actual clearing is handled by the settings page calling useRowingStore.getState().clearSessions()
        // This method is kept for API consistency but doesn't need to do anything for sessions
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
    // Guard against SSR/non-browser environments
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    // Clear all app-specific localStorage items
    const keysToRemove = [
      'rowing-tracker-storage',  // Zustand store containing sessions, records, awards, etc.
      'rowing_ai_chat_sessions',
      'rowing_ai_current_session',
      'rowing_training_plans',
      'rowing_active_training_plan',
      this.STORAGE_KEY
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Save settings to localStorage and sync to database (debounced)
   */
  private saveSettings(settings: Settings): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    this.debouncedSyncToDatabase(settings);
  }

  /**
   * Debounced sync to database to prevent excessive API calls
   */
  private debouncedSyncToDatabase(settings: Settings): void {
    // Clear existing timeout
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    // Create string representation to compare with last synced data
    const currentData = JSON.stringify(settings);
    
    // Skip if data hasn't changed
    if (currentData === this.lastSyncedData) {
      return;
    }

    // Set new timeout
    this.syncTimeout = setTimeout(async () => {
      await this.syncToDatabase(settings);
      this.lastSyncedData = currentData;
    }, 1000); // 1 second debounce
  }

  private migrateSettings(settings: Partial<Settings>): Settings {
    const migratedSettings = { ...settings } as Settings;

    // Ensure UserPreferences has all required fields
    migratedSettings.userPreferences = {
      ...this.defaultSettings.userPreferences,
      ...migratedSettings.userPreferences,
      // Explicitly preserve lightModeBrightness if it exists, otherwise use default
      lightModeBrightness: migratedSettings.userPreferences?.lightModeBrightness ?? this.defaultSettings.userPreferences.lightModeBrightness,
      customPrompts: migratedSettings.userPreferences?.customPrompts || []
    };

    // Handle AI settings migration from old flat structure to new nested structure
    if (settings.aiSettings) {
      const oldAiSettings = settings.aiSettings as AISettings & { model?: string; temperature?: number };

      // Check if this is the old format (has flat model/temperature properties)
      if (oldAiSettings.model || oldAiSettings.temperature !== undefined) {

        // Transform old flat settings to new nested structure (GPT-5.1 only)
        migratedSettings.aiSettings = {
          ...this.defaultSettings.aiSettings,
          // Preserve old properties that still exist
          cloudAIEnabled: oldAiSettings.cloudAIEnabled ?? this.defaultSettings.aiSettings.cloudAIEnabled,
          openaiApiKey: oldAiSettings.openaiApiKey ?? this.defaultSettings.aiSettings.openaiApiKey,
          maxTokens: oldAiSettings.maxTokens ?? this.defaultSettings.aiSettings.maxTokens,
          systemPrompt: oldAiSettings.systemPrompt ?? this.defaultSettings.aiSettings.systemPrompt,
          chatSystemPrompt: oldAiSettings.chatSystemPrompt ?? this.defaultSettings.aiSettings.chatSystemPrompt,
          planGenerationPrompt: oldAiSettings.planGenerationPrompt ?? this.defaultSettings.aiSettings.planGenerationPrompt,
          insightsPrompt: oldAiSettings.insightsPrompt ?? this.defaultSettings.aiSettings.insightsPrompt,
          // Always use new default explainChartPrompt - improved format with "Why This Chart Matters" section
          explainChartPrompt: this.defaultSettings.aiSettings.explainChartPrompt,

          // New nested structure without model fields (hardcoded to GPT-5.1)
          chat: this.defaultSettings.aiSettings.chat,
          insights: this.defaultSettings.aiSettings.insights,
          trainingPlans: this.defaultSettings.aiSettings.trainingPlans,
          awardSuggestions: this.defaultSettings.aiSettings.awardSuggestions,
          awardSuggestionsPrompt: oldAiSettings.awardSuggestionsPrompt ?? this.defaultSettings.aiSettings.awardSuggestionsPrompt,
          // Preserve achievement image settings
          achievementImageModel: oldAiSettings.achievementImageModel ?? this.defaultSettings.aiSettings.achievementImageModel,
          achievementImageQuality: oldAiSettings.achievementImageQuality ?? this.defaultSettings.aiSettings.achievementImageQuality,
          achievementImageSize: oldAiSettings.achievementImageSize ?? this.defaultSettings.aiSettings.achievementImageSize,
          achievementImageColors: oldAiSettings.achievementImageColors ?? this.defaultSettings.aiSettings.achievementImageColors
        };
      } else if (oldAiSettings.chat?.model || oldAiSettings.insights?.model || oldAiSettings.trainingPlans?.model || oldAiSettings.awardSuggestions?.model) {
        migratedSettings.aiSettings = {
          ...this.defaultSettings.aiSettings,
          ...oldAiSettings,
          // Preserve the nested structure with model fields
          chat: { ...this.defaultSettings.aiSettings.chat, ...oldAiSettings.chat },
          insights: { ...this.defaultSettings.aiSettings.insights, ...oldAiSettings.insights },
          trainingPlans: { ...this.defaultSettings.aiSettings.trainingPlans, ...oldAiSettings.trainingPlans },
          awardSuggestions: { ...this.defaultSettings.aiSettings.awardSuggestions, ...oldAiSettings.awardSuggestions },
          // Preserve achievement image settings that user may have configured
          achievementImageModel: oldAiSettings.achievementImageModel ?? this.defaultSettings.aiSettings.achievementImageModel,
          achievementImageQuality: oldAiSettings.achievementImageQuality ?? this.defaultSettings.aiSettings.achievementImageQuality,
          achievementImageSize: oldAiSettings.achievementImageSize ?? this.defaultSettings.aiSettings.achievementImageSize,
          achievementImageColors: oldAiSettings.achievementImageColors ?? this.defaultSettings.aiSettings.achievementImageColors
        };
      } else {
        // New format - just ensure all nested properties exist
        migratedSettings.aiSettings = {
          ...this.defaultSettings.aiSettings,
          ...oldAiSettings,
          chat: { ...this.defaultSettings.aiSettings.chat, ...oldAiSettings.chat },
          insights: { ...this.defaultSettings.aiSettings.insights, ...oldAiSettings.insights },
          trainingPlans: { ...this.defaultSettings.aiSettings.trainingPlans, ...oldAiSettings.trainingPlans },
          awardSuggestions: { ...this.defaultSettings.aiSettings.awardSuggestions, ...oldAiSettings.awardSuggestions },
          // Preserve achievement image settings that user may have configured
          achievementImageModel: oldAiSettings.achievementImageModel ?? this.defaultSettings.aiSettings.achievementImageModel,
          achievementImageQuality: oldAiSettings.achievementImageQuality ?? this.defaultSettings.aiSettings.achievementImageQuality,
          achievementImageSize: oldAiSettings.achievementImageSize ?? this.defaultSettings.aiSettings.achievementImageSize,
          achievementImageColors: oldAiSettings.achievementImageColors ?? this.defaultSettings.aiSettings.achievementImageColors
        };
      }
    } else {
      // No AI settings exist - use defaults
      migratedSettings.aiSettings = { ...this.defaultSettings.aiSettings };
    }

    // Handle version migration and ensure all properties exist
    if (!settings.version || settings.version !== this.CURRENT_VERSION) {
      // Additional migration: ensure model fields exist in nested configs (v1.1.0 fix)
      if (migratedSettings.aiSettings) {
        const needsModelMigration =
          !migratedSettings.aiSettings.chat?.model ||
          !migratedSettings.aiSettings.insights?.model ||
          !migratedSettings.aiSettings.trainingPlans?.model ||
          !migratedSettings.aiSettings.awardSuggestions?.model;

        if (needsModelMigration) {
          migratedSettings.aiSettings = {
            ...migratedSettings.aiSettings,
            chat: {
              ...this.defaultSettings.aiSettings.chat,
              ...migratedSettings.aiSettings.chat
            },
            insights: {
              ...this.defaultSettings.aiSettings.insights,
              ...migratedSettings.aiSettings.insights
            },
            trainingPlans: {
              ...this.defaultSettings.aiSettings.trainingPlans,
              ...migratedSettings.aiSettings.trainingPlans
            },
            awardSuggestions: {
              ...this.defaultSettings.aiSettings.awardSuggestions,
              ...migratedSettings.aiSettings.awardSuggestions
            },
            // Preserve achievement image settings that user may have configured
            achievementImageModel: migratedSettings.aiSettings.achievementImageModel ?? this.defaultSettings.aiSettings.achievementImageModel,
            achievementImageQuality: migratedSettings.aiSettings.achievementImageQuality ?? this.defaultSettings.aiSettings.achievementImageQuality,
            achievementImageSize: migratedSettings.aiSettings.achievementImageSize ?? this.defaultSettings.aiSettings.achievementImageSize,
            achievementImageColors: migratedSettings.aiSettings.achievementImageColors ?? this.defaultSettings.aiSettings.achievementImageColors
          };
        }

        // v1.2.0: Force update explainChartPrompt to new "Why This Chart Matters" format
        migratedSettings.aiSettings.explainChartPrompt = this.defaultSettings.aiSettings.explainChartPrompt;
      }

      return {
        ...migratedSettings,
        version: this.CURRENT_VERSION,
        updatedAt: new Date()
      };
    }

    return migratedSettings;
  }

  private validateSettings(settings: unknown): boolean {
    try {
      // Basic structure validation
      if (!settings || typeof settings !== 'object') return false;
      const requiredKeys = ['userPreferences', 'dataManagement', 'trainingSettings',
        'notificationSettings', 'privacySettings', 'aiSettings'];

      return requiredKeys.every(key => key in (settings as Record<string, unknown>));
    } catch {
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
