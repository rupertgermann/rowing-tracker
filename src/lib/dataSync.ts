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

/**
 * Save personal records to database
 */
export async function savePRsToDB(prs: PersonalRecord[]): Promise<SyncResult> {
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
 * Initialize store with data from database
 * Call this when user logs in or app loads
 */
export async function initializeStoreFromDB() {
  const [sessions, prs, awards] = await Promise.all([
    fetchSessionsFromDB(),
    fetchPRsFromDB(),
    fetchAwardsFromDB(),
  ]);

  return {
    sessions,
    personalRecords: prs,
    earnedAwards: awards,
  };
}
