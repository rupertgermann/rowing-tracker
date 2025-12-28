/**
 * Data Synchronization Layer
 * Handles fetching and syncing data between database and Zustand store
 */

import { Session, PersonalRecord } from '@/types/session';
import { EarnedAward } from '@/lib/awards';
import {
  getCachedSessions,
  cacheSessionsData,
  clearSessionsCache,
} from '@/lib/services/sessionsCache';

export interface SyncResult {
  success: boolean;
  error?: string;
}

export interface SessionsListResponse {
  sessions: Session[];
  sessionsRevision: number;
  count: number;
}

/**
 * Fetch sessions from the lightweight list endpoint (no strokeData).
 * This is MUCH faster than the full /api/sessions endpoint.
 */
export async function fetchSessionsListFromDB(): Promise<SessionsListResponse> {
  try {
    const response = await fetch('/api/sessions/list');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SYNC] Failed to fetch sessions list:', errorText);
      throw new Error('Failed to fetch sessions list');
    }
    const data = await response.json();
    return {
      sessions: data.sessions || [],
      sessionsRevision: data.sessionsRevision ?? 0,
      count: data.count ?? 0,
    };
  } catch (error) {
    console.error('[SYNC] Error fetching sessions list:', error);
    return { sessions: [], sessionsRevision: 0, count: 0 };
  }
}

/**
 * Fetch all sessions from database with caching.
 * Uses the lightweight list endpoint and localStorage cache.
 *
 * Cache strategy:
 * 1. Check localStorage cache
 * 2. Fetch from API to check revision
 * 3. If revisions match, return cached data (very fast)
 * 4. If revisions differ, use fresh data and update cache
 */
export async function fetchSessionsFromDBWithCache(): Promise<Session[]> {
  const cached = getCachedSessions();

  try {
    const { sessions, sessionsRevision } = await fetchSessionsListFromDB();

    // Check if cache is still valid
    if (cached && cached.sessionsRevision === sessionsRevision) {
      console.log('[SYNC] Sessions cache hit (revision match)');
      return cached.sessions;
    }

    // Cache miss or stale - update cache
    console.log('[SYNC] Sessions cache miss - caching fresh data');
    cacheSessionsData(sessions, sessionsRevision);
    return sessions;
  } catch (error) {
    console.error('[SYNC] Error fetching sessions:', error);

    // Return cached data if available
    if (cached) {
      console.log('[SYNC] Using stale cache due to fetch error');
      return cached.sessions;
    }

    return [];
  }
}

/**
 * Fetch all sessions from database (full data with strokeData).
 * Only use this when you need strokeData for specific sessions.
 * @deprecated Use fetchSessionsFromDBWithCache() for analytics/list views
 */
export async function fetchSessionsFromDB(): Promise<Session[]> {
  try {
    const response = await fetch('/api/sessions');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SYNC] Failed to fetch sessions:', errorText);
      throw new Error('Failed to fetch sessions');
    }
    const data = await response.json();
    return data.sessions || [];
  } catch (error) {
    console.error('[SYNC] Error fetching sessions:', error);
    return [];
  }
}

/**
 * Progress callback for chunked uploads
 */
export interface UploadProgress {
  current: number;    // Current chunk being processed
  total: number;      // Total number of chunks
  sessionsProcessed: number;  // Total sessions processed so far
  totalSessions: number;      // Total sessions to process
  message: string;    // Human-readable progress message
}

/**
 * Save sessions to database in chunks for large uploads
 */
export async function saveSessionsToDBChunked(
  sessions: Session[],
  onProgress?: (progress: UploadProgress) => void,
  chunkSize: number = 25
): Promise<SyncResult> {
  if (sessions.length === 0) {
    return { success: true };
  }

  const totalChunks = Math.ceil(sessions.length / chunkSize);
  let sessionsProcessed = 0;

  console.log(`[SYNC] Starting chunked upload: ${sessions.length} sessions in ${totalChunks} chunks`);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, sessions.length);
    const chunk = sessions.slice(start, end);

    const progress: UploadProgress = {
      current: i + 1,
      total: totalChunks,
      sessionsProcessed,
      totalSessions: sessions.length,
      message: `Processing sessions ${start + 1}-${end} of ${sessions.length}...`
    };
    onProgress?.(progress);

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: chunk }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`[SYNC] Chunk ${i + 1}/${totalChunks} failed:`, error);
        return {
          success: false,
          error: `Failed at chunk ${i + 1}/${totalChunks}: ${error.error || 'Unknown error'}`
        };
      }

      sessionsProcessed += chunk.length;
      console.log(`[SYNC] Chunk ${i + 1}/${totalChunks} complete (${sessionsProcessed}/${sessions.length} sessions)`);
    } catch (error) {
      console.error(`[SYNC] Error in chunk ${i + 1}/${totalChunks}:`, error);
      return {
        success: false,
        error: `Network error at chunk ${i + 1}/${totalChunks}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Final progress update
  onProgress?.({
    current: totalChunks,
    total: totalChunks,
    sessionsProcessed: sessions.length,
    totalSessions: sessions.length,
    message: 'Upload complete!'
  });

  return { success: true };
}

/**
 * Save sessions to database (simple version for small batches)
 */
export async function saveSessionsToDB(sessions: Session[]): Promise<SyncResult> {
  // For large uploads, use chunked upload
  if (sessions.length > 25) {
    return saveSessionsToDBChunked(sessions);
  }

  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[SYNC] Save failed:', error);
      return { success: false, error: error.error || 'Failed to save sessions' };
    }

    const result = await response.json();
    return { success: true };
  } catch (error) {
    console.error('[SYNC] Error saving sessions:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch all personal records from database
 */
export async function fetchPRsFromDB(): Promise<PersonalRecord[]> {
  try {
    const response = await fetch('/api/prs');
    if (!response.ok) {
      throw new Error('Failed to fetch PRs');
    }
    const data = await response.json();
    return data.prs || [];
  } catch (error) {
    console.error('Error fetching PRs:', error);
    return [];
  }
}

// API format for saving PRs (different from PersonalRecord type)
interface PRSaveData {
  distance: number;
  value: number;
  bestPace?: number;
  avgPower?: number;
  achievedAt: Date;
  sessionId: string;
}

/**
 * Save personal records to database
 */
export async function savePRsToDB(prs: PRSaveData[]): Promise<SyncResult> {
  try {
    const response = await fetch('/api/prs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prs }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to save PRs' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving PRs:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch all earned awards from database
 */
export async function fetchAwardsFromDB(): Promise<EarnedAward[]> {
  try {
    const response = await fetch('/api/awards');
    if (!response.ok) {
      throw new Error('Failed to fetch awards');
    }
    const data = await response.json();
    return data.awards || [];
  } catch (error) {
    console.error('Error fetching awards:', error);
    return [];
  }
}

/**
 * Save earned awards to database
 */
export async function saveAwardsToDB(awards: EarnedAward[]): Promise<SyncResult> {
  try {
    const response = await fetch('/api/awards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awards }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to save awards' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving awards:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch training plans from database
 */
export async function fetchTrainingPlansFromDB(): Promise<any[]> {
  try {
    const response = await fetch('/api/training-plans');
    if (!response.ok) {
      throw new Error('Failed to fetch training plans');
    }
    const data = await response.json();
    return data.plans || [];
  } catch (error) {
    console.error('Error fetching training plans:', error);
    return [];
  }
}

/**
 * Save training plans to database
 */
export async function saveTrainingPlansToDB(plans: any[]): Promise<SyncResult> {
  try {
    const response = await fetch('/api/training-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plans }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to save training plans' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving training plans:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch AI insights from database
 */
export async function fetchInsightsFromDB(): Promise<any[]> {
  try {
    const response = await fetch('/api/insights');
    if (!response.ok) {
      throw new Error('Failed to fetch insights');
    }
    const data = await response.json();
    const insights = data.insights || [];
    (insights as any).sessionsRevision = data.sessionsRevision ?? 0;
    (insights as any).insightsRevision = data.insightsRevision ?? 0;
    return insights;
  } catch (error) {
    console.error('Error fetching insights:', error);
    return [];
  }
}

/**
 * Save AI insights to database
 */
export async function saveInsightsToDB(
  insights: any[],
  options?: { markAsCurrent?: boolean }
): Promise<SyncResult> {
  try {
    const response = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insights, markAsCurrent: Boolean(options?.markAsCurrent) }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to save insights' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving insights:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch chat sessions from database
 */
export async function fetchChatSessionsFromDB(): Promise<any[]> {
  try {
    const response = await fetch('/api/chat');
    if (!response.ok) {
      throw new Error('Failed to fetch chat sessions');
    }
    const data = await response.json();
    return data.chatSessions || [];
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return [];
  }
}

/**
 * Fetch chart settings from database
 */
export async function fetchChartSettingsFromDB(): Promise<any | null> {
  try {
    const response = await fetch('/api/settings');
    if (!response.ok) {
      throw new Error('Failed to fetch settings');
    }
    const data = await response.json();
    return data.settings?.chartSettings || null;
  } catch (error) {
    console.error('Error fetching chart settings:', error);
    return null;
  }
}

/**
 * Save chart settings to database
 */
export async function saveChartSettingsToDB(chartSettings: any): Promise<SyncResult> {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chartSettings }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to save chart settings' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving chart settings:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch AI insights archive from database
 */
export async function fetchArchivedInsightsFromDB(): Promise<any[]> {
  try {
    const response = await fetch('/api/insights');
    if (!response.ok) {
      throw new Error('Failed to fetch archived insights');
    }
    const data = await response.json();
    const allInsights = data.insights || [];
    const archivedInsights = allInsights.filter((insight: any) => insight.archived);
    return archivedInsights;
  } catch (error) {
    console.error('[DATA SYNC DEBUG] Error fetching archived insights:', error);
    return [];
  }
}

/**
 * Save AI insights archive to database
 */
export async function saveArchivedInsightsToDB(insights: any[]): Promise<SyncResult> {
  try {
    const response = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insights, archived: true }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to save archived insights' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving archived insights:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Delete all AI insights from database (for cache invalidation)
 */
export async function deleteAllInsightsFromDB(): Promise<SyncResult> {
  try {
    const response = await fetch('/api/insights', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivedOnly: true }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to delete insights' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting insights:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Save chat sessions to database
 */
export async function saveChatSessionsToDB(chatSessions: any[]): Promise<SyncResult> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatSessions }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to save chat sessions' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving chat sessions:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch user settings from database
 */
export async function fetchSettingsFromDB(): Promise<any> {
  try {
    const response = await fetch('/api/settings');
    if (!response.ok) {
      throw new Error('Failed to fetch settings');
    }
    const data = await response.json();
    return data.settings || null;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return null;
  }
}

/**
 * Save user settings to database
 */
export async function saveSettingsToDB(settings: any): Promise<SyncResult> {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to save settings' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch generated achievements from database
 */
export async function fetchGeneratedAchievementsFromDB(): Promise<any[]> {
  
  try {
    const response = await fetch('/api/generated-achievements');
    
    if (!response.ok) {
      const error = await response.json();
      console.error('[DATA SYNC] Fetch failed:', error);
      throw new Error('Failed to fetch generated achievements');
    }
    
    const data = await response.json();
    return data.achievements || [];
  } catch (error) {
    console.error('[DATA SYNC] Error fetching generated achievements:', error);
    return [];
  }
}

/**
 * Save generated achievements to database
 */
export async function saveGeneratedAchievementsToDB(achievements: any[]): Promise<SyncResult> {
  
  try {
    const response = await fetch('/api/generated-achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievements }),
    });

    
    if (!response.ok) {
      const error = await response.json();
      console.error('[DATA SYNC] Save failed:', error);
      return { success: false, error: error.error || 'Failed to save generated achievements' };
    }

    const result = await response.json();
    return { success: true };
  } catch (error) {
    console.error('[DATA SYNC] Error saving generated achievements:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch memory documents from database
 */
export async function fetchMemoryDocumentsFromDB(): Promise<any[]> {
  try {
    const response = await fetch('/api/memory');
    if (!response.ok) {
      throw new Error('Failed to fetch memory documents');
    }
    const data = await response.json();
    return data.documents || [];
  } catch (error) {
    console.error('Error fetching memory documents:', error);
    return [];
  }
}

/**
 * Save memory documents to database
 */
export async function saveMemoryDocumentsToDB(documents: any[]): Promise<SyncResult> {
  try {
    const response = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to save memory documents' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving memory documents:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Initialize store with data from database
 * Call this when user logs in or app loads.
 */
export async function initializeStoreFromDB() {
  const [
    sessions,
    prs,
    awards,
    trainingPlans,
    insights,
    chatSessions,
    settings,
    generatedAchievements,
    memoryDocuments,
    chartSettings
  ] = await Promise.all([
    fetchSessionsFromDB(), // Full sessions with strokeData for session details
    fetchPRsFromDB(),
    fetchAwardsFromDB(),
    fetchTrainingPlansFromDB(),
    fetchInsightsFromDB(),
    fetchChatSessionsFromDB(),
    fetchSettingsFromDB(),
    fetchGeneratedAchievementsFromDB(),
    fetchMemoryDocumentsFromDB(),
    fetchChartSettingsFromDB(),
  ]);

  return {
    sessions,
    personalRecords: prs,
    earnedAwards: awards,
    trainingPlans,
    insights,
    chatSessions,
    settings,
    generatedAchievements,
    memoryDocuments,
    chartSettings,
  };
}
