import { settings } from './settings';
import { cloudAI } from './cloudAI';

/**
 * AI Configuration Helper
 * 
 * This helper centralizes AI coach initialization logic and ensures
 * consistent behavior across all AI features (chat, insights, training plans).
 * 
 * Features:
 * - Reads AI settings from SettingsService (single source of truth)
 * - Initializes cloudAI with user's API key when enabled
 * - Falls back to environment variable if user hasn't configured AI
 * - Safe for client-side only usage with SSR guards
 * - Idempotent: can be called multiple times safely
 */

export interface AIConfigurationStatus {
  isConfigured: boolean;
  isUserEnabled: boolean;
  hasUserApiKey: boolean;
  hasEnvApiKey: boolean;
  source: 'user-settings' | 'environment' | 'none';
}

/**
 * Initialize Cloud AI from user settings
 * 
 * This function should be called before any AI operations to ensure
 * cloudAI is properly configured with the user's preferences.
 * 
 * @returns boolean - true if AI is configured and ready to use
 */
export function initializeCloudAIFromSettings(): boolean {
  // Guard against SSR/non-browser environments
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  try {
    const aiSettings = settings.getAISettings();
    
    // Check if user has explicitly enabled cloud AI
    if (!aiSettings.cloudAIEnabled) {
      // User has disabled AI, don't initialize even if env key exists
      return false;
    }

    // Check if user has provided an API key
    if (aiSettings.openaiApiKey && aiSettings.openaiApiKey.trim()) {
      const success = cloudAI.initialize(aiSettings.openaiApiKey);
      return success;
    }

    // Fallback: try environment variable if user hasn't provided key
    // This allows read-only/low-friction usage when env key is available
    // but user hasn't explicitly configured their own key
    const envKeyAvailable = cloudAI.initialize(); // initialize() with no args uses env var
    return envKeyAvailable;

  } catch (error) {
    console.error('Failed to initialize Cloud AI from settings:', error);
    return false;
  }
}

/**
 * Get current AI configuration status
 * 
 * Useful for UI components to determine what state to show:
 * - Not configured (needs setup)
 * - Configured with user key (full functionality)
 * - Configured with env key (limited functionality)
 * - Disabled by user
 * 
 * @returns AIConfigurationStatus - detailed status information
 */
export function getAIConfigurationStatus(): AIConfigurationStatus {
  // Guard against SSR/non-browser environments
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {
      isConfigured: false,
      isUserEnabled: false,
      hasUserApiKey: false,
      hasEnvApiKey: false,
      source: 'none'
    };
  }

  try {
    const aiSettings = settings.getAISettings();
    const isUserEnabled = aiSettings.cloudAIEnabled;
    const hasUserApiKey = Boolean(aiSettings.openaiApiKey && aiSettings.openaiApiKey.trim());
    
    // Check if environment key exists (without exposing it)
    const hasEnvApiKey = Boolean(process.env.NEXT_PUBLIC_OPENAI_API_KEY);
    
    // Determine if cloudAI is currently configured
    const isConfigured = cloudAI.isConfigured();
    
    // Determine the source of configuration
    let source: 'user-settings' | 'environment' | 'none';
    if (isConfigured && hasUserApiKey && isUserEnabled) {
      source = 'user-settings';
    } else if (isConfigured && hasEnvApiKey && isUserEnabled) {
      source = 'environment';
    } else {
      source = 'none';
    }

    return {
      isConfigured,
      isUserEnabled,
      hasUserApiKey,
      hasEnvApiKey,
      source
    };

  } catch (error) {
    console.error('Failed to get AI configuration status:', error);
    return {
      isConfigured: false,
      isUserEnabled: false,
      hasUserApiKey: false,
      hasEnvApiKey: false,
      source: 'none'
    };
  }
}

/**
 * Check if AI features should be available
 * 
 * This is the main gatekeeper function for AI features.
 * It combines the user's enablement preference with API key availability.
 * 
 * @returns boolean - true if AI features can be used
 */
export function isAIAvailable(): boolean {
  const status = getAIConfigurationStatus();
  return status.isUserEnabled && status.isConfigured;
}

/**
 * Get user-friendly error message for AI configuration issues
 * 
 * @returns string - appropriate error message or null if no issues
 */
export function getAIConfigurationErrorMessage(): string | null {
  const status = getAIConfigurationStatus();
  
  if (!status.isUserEnabled) {
    return 'Cloud AI is disabled in settings. Enable it to use AI features.';
  }
  
  if (!status.hasUserApiKey && !status.hasEnvApiKey) {
    return 'No OpenAI API key configured. Add your API key in Settings to use AI features.';
  }
  
  if (!status.isConfigured) {
    return 'AI service failed to initialize. Please check your API key configuration.';
  }
  
  return null;
}
