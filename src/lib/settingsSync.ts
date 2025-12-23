/**
 * Settings synchronization with database
 * Provides async methods to fetch and save settings from/to the database API
 */

import { Settings, AISettings } from '@/lib/settings';

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
