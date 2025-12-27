/**
 * Data Synchronization Layer
 * Handles fetching and syncing data between database and Zustand store
 */

import { Session, PersonalRecord } from '@/types/session';
import { EarnedAward } from '@/lib/awards';

export interface SyncResult {
  success: boolean;
  error?: string;
}

/**
 * Fetch all sessions from database
 */
export async function fetchSessionsFromDB(): Promise<Session[]> {
  try {
    console.log('[SYNC] Fetching sessions from /api/sessions');
    const response = await fetch('/api/sessions');
    console.log('[SYNC] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SYNC] Failed to fetch sessions:', errorText);
      throw new Error('Failed to fetch sessions');
    }
    const data = await response.json();
    console.log('[SYNC] Fetched sessions:', data.sessions?.length || 0);
    return data.sessions || [];
  } catch (error) {
    console.error('[SYNC] Error fetching sessions:', error);
    return [];
  }
}

/**
 * Save sessions to database
 */
export async function saveSessionsToDB(sessions: Session[]): Promise<SyncResult> {
  try {
    console.log('[SYNC] Saving', sessions.length, 'sessions to database');
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions }),
    });

    console.log('[SYNC] Save response status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('[SYNC] Save failed:', error);
      return { success: false, error: error.error || 'Failed to save sessions' };
    }

    const result = await response.json();
    console.log('[SYNC] Save successful:', result);
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
    return data.insights || [];
  } catch (error) {
    console.error('Error fetching insights:', error);
    return [];
  }
}

/**
 * Save AI insights to database
 */
export async function saveInsightsToDB(insights: any[]): Promise<SyncResult> {
  try {
    const response = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insights }),
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
    const response = await fetch('/api/insights?archived=true');
    if (!response.ok) {
      throw new Error('Failed to fetch archived insights');
    }
    const data = await response.json();
    return data.insights || [];
  } catch (error) {
    console.error('Error fetching archived insights:', error);
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
  console.log('[DATA SYNC] Fetching achievements from DB');
  
  try {
    const response = await fetch('/api/generated-achievements');
    console.log('[DATA SYNC] Fetch response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      console.error('[DATA SYNC] Fetch failed:', error);
      throw new Error('Failed to fetch generated achievements');
    }
    
    const data = await response.json();
    console.log('[DATA SYNC] Fetched achievements:', data.achievements?.length || 0, 'items');
    console.log('[DATA SYNC] Achievement data:', JSON.stringify(data.achievements, null, 2));
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
  console.log('[DATA SYNC] Saving achievements to DB:', achievements.length, 'items');
  console.log('[DATA SYNC] Achievement data:', JSON.stringify(achievements, null, 2));
  
  try {
    const response = await fetch('/api/generated-achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievements }),
    });

    console.log('[DATA SYNC] Save response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      console.error('[DATA SYNC] Save failed:', error);
      return { success: false, error: error.error || 'Failed to save generated achievements' };
    }

    const result = await response.json();
    console.log('[DATA SYNC] Save successful:', result);
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
 * Call this when user logs in or app loads
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
    fetchSessionsFromDB(),
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
