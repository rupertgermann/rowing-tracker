/**
 * Settings synchronization with database
 * Consolidated module for all settings and API key sync operations
 */

import { Settings, AISettings } from '@/lib/settings';

// ============================================================================
// General Settings API
// ============================================================================

/**
 * Fetch user settings from database
 */
export async function fetchSettingsFromDB(): Promise<Settings | null> {
  try {
    const response = await fetch('/api/settings', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error('Failed to fetch settings:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.settings || null;
  } catch (error) {
    console.error('Error fetching settings from database:', error);
    return null;
  }
}

/**
 * Save user settings to database
 */
export async function saveSettingsToDB(settings: Partial<Settings>): Promise<boolean> {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      console.error('Failed to save settings:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving settings to database:', error);
    return false;
  }
}

/**
 * Save AI settings specifically
 */
export async function saveAISettingsToDB(aiSettings: Partial<AISettings>): Promise<boolean> {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiSettings }),
    });

    if (!response.ok) {
      console.error('Failed to save AI settings:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving AI settings to database:', error);
    return false;
  }
}

/**
 * Save user profile context
 */
export async function saveUserProfileContextToDB(
  userProfileContext: string,
  userProfileRawInput: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userProfileContext,
        userProfileRawInput,
      }),
    });

    if (!response.ok) {
      console.error('Failed to save user profile context:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving user profile context to database:', error);
    return false;
  }
}

// ============================================================================
// API Key Management (encrypted storage)
// ============================================================================

/**
 * Save API key securely to database
 * Key is encrypted on the server side
 */
export async function saveAPIKeyToDB(
  provider: string,
  apiKey: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/ai-config/api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey }),
    });

    if (!response.ok) {
      console.error('Failed to save API key:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving API key to database:', error);
    return false;
  }
}

/**
 * Get API key from database
 * Key is decrypted on the server side
 */
export async function getAPIKeyFromDB(provider: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/ai-config/api-key?provider=${encodeURIComponent(provider)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error('Failed to get API key:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.apiKey || null;
  } catch (error) {
    console.error('Error getting API key from database:', error);
    return null;
  }
}

/**
 * Delete API key from database
 */
export async function deleteAPIKeyFromDB(provider: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/ai-config/api-key?provider=${encodeURIComponent(provider)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error('Failed to delete API key:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting API key from database:', error);
    return false;
  }
}
