/**
 * Settings synchronization with database
 * Consolidated module for all settings and API key sync operations
 */

import { Settings, AISettings } from '@/lib/settings';

// ============================================================================
// Retry Configuration
// ============================================================================

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function getRetryDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Check if an HTTP status code should trigger a retry
 * Don't retry client errors (4xx) except for 408 (timeout) and 429 (rate limit)
 */
function shouldRetry(status: number): boolean {
  if (status === 408 || status === 429) return true;
  if (status >= 400 && status < 500) return false;
  return status >= 500 || status === 0;
}

/**
 * Generic retry wrapper for fetch operations
 */
async function fetchWithRetry<T>(
  operation: () => Promise<Response>,
  parseResponse: (response: Response) => Promise<T>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  let lastError: string = 'Unknown error';

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await operation();

      if (response.ok) {
        const data = await parseResponse(response);
        return { success: true, data };
      }

      // Check if we should retry this status
      if (!shouldRetry(response.status)) {
        lastError = `${response.status}: ${response.statusText}`;
        console.error(`[settingsSync] ${operationName} failed (non-retryable):`, lastError);
        return { success: false, error: lastError };
      }

      lastError = `${response.status}: ${response.statusText}`;

      if (attempt < config.maxRetries) {
        const delay = getRetryDelay(attempt, config);
        console.warn(
          `[settingsSync] ${operationName} failed (attempt ${attempt + 1}/${config.maxRetries + 1}), ` +
          `retrying in ${Math.round(delay)}ms...`
        );
        await sleep(delay);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Network error';

      if (attempt < config.maxRetries) {
        const delay = getRetryDelay(attempt, config);
        console.warn(
          `[settingsSync] ${operationName} error (attempt ${attempt + 1}/${config.maxRetries + 1}): ${lastError}, ` +
          `retrying in ${Math.round(delay)}ms...`
        );
        await sleep(delay);
      }
    }
  }

  console.error(`[settingsSync] ${operationName} failed after ${config.maxRetries + 1} attempts:`, lastError);
  return { success: false, error: lastError };
}

// ============================================================================
// General Settings API
// ============================================================================

/**
 * Fetch user settings from database with retry logic
 */
export async function fetchSettingsFromDB(): Promise<Settings | null> {
  const result = await fetchWithRetry(
    () => fetch('/api/settings', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }),
    async (response) => {
      const data = await response.json();
      return data.settings || null;
    },
    'fetchSettings'
  );

  return result.success ? result.data : null;
}

/**
 * Save user settings to database with retry logic
 */
export async function saveSettingsToDB(settings: Partial<Settings>): Promise<boolean> {
  const result = await fetchWithRetry(
    () => fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }),
    async () => true,
    'saveSettings'
  );

  return result.success;
}

/**
 * Save AI settings specifically with retry logic
 */
export async function saveAISettingsToDB(aiSettings: Partial<AISettings>): Promise<boolean> {
  const result = await fetchWithRetry(
    () => fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiSettings }),
    }),
    async () => true,
    'saveAISettings'
  );

  return result.success;
}

/**
 * Save user profile context with retry logic
 */
export async function saveUserProfileContextToDB(
  userProfileContext: string,
  userProfileRawInput: string
): Promise<boolean> {
  const result = await fetchWithRetry(
    () => fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userProfileContext,
        userProfileRawInput,
      }),
    }),
    async () => true,
    'saveUserProfileContext'
  );

  return result.success;
}

// ============================================================================
// API Key Management (encrypted storage)
// ============================================================================

/**
 * Save API key securely to database with retry logic
 * Key is encrypted on the server side
 */
export async function saveAPIKeyToDB(
  provider: string,
  apiKey: string
): Promise<boolean> {
  const result = await fetchWithRetry(
    () => fetch('/api/ai-config/api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey }),
    }),
    async () => true,
    'saveAPIKey'
  );

  return result.success;
}

/**
 * Get API key from database with retry logic
 * Key is decrypted on the server side
 */
export async function getAPIKeyFromDB(provider: string): Promise<string | null> {
  const result = await fetchWithRetry(
    () => fetch(`/api/ai-config/api-key?provider=${encodeURIComponent(provider)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }),
    async (response) => {
      const data = await response.json();
      return data.apiKey || null;
    },
    'getAPIKey'
  );

  return result.success ? result.data : null;
}

/**
 * Delete API key from database with retry logic
 */
export async function deleteAPIKeyFromDB(provider: string): Promise<boolean> {
  const result = await fetchWithRetry(
    () => fetch(`/api/ai-config/api-key?provider=${encodeURIComponent(provider)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    }),
    async () => true,
    'deleteAPIKey'
  );

  return result.success;
}
