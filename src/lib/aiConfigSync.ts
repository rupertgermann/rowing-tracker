/**
 * AI Configuration synchronization with database
 * Handles secure storage and retrieval of API keys and AI settings
 */

/**
 * Fetch AI configuration from database
 */
export async function fetchAIConfigFromDB(): Promise<any> {
  try {
    const response = await fetch('/api/ai-config', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error('Failed to fetch AI config:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.config || null;
  } catch (error) {
    console.error('Error fetching AI config from database:', error);
    return null;
  }
}

/**
 * Save AI configuration to database
 */
export async function saveAIConfigToDB(config: any): Promise<boolean> {
  try {
    const response = await fetch('/api/ai-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      console.error('Failed to save AI config:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving AI config to database:', error);
    return false;
  }
}

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
    const response = await fetch(`/api/ai-config/api-key?provider=${provider}`, {
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
    const response = await fetch(`/api/ai-config/api-key?provider=${provider}`, {
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
