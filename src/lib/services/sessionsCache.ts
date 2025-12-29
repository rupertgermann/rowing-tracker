/**
 * Sessions Cache Service
 *
 * Provides localStorage-based caching for session data with version-based invalidation.
 * This dramatically improves analytics page load times by avoiding unnecessary API calls
 * when data hasn't changed.
 *
 * Key features:
 * - Stores session metadata (without strokeData) in localStorage
 * - Uses sessionsRevision for cache invalidation
 * - Provides instant data on page load with background refresh
 */

import { Session } from '@/types/session';

interface CachedSessionsData {
  sessions: Session[];
  sessionsRevision: number;
  cachedAt: number;
}

const SESSIONS_CACHE_KEY = 'rowing_sessions_cache';
const REVISION_CACHE_KEY = 'rowing_sessions_revision';
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours max cache age

/**
 * Get cached sessions from localStorage
 */
export function getCachedSessions(): CachedSessionsData | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(SESSIONS_CACHE_KEY);
    if (!cached) return null;

    const data: CachedSessionsData = JSON.parse(cached);

    // Check if cache is too old
    if (Date.now() - data.cachedAt > MAX_CACHE_AGE_MS) {
      clearSessionsCache();
      return null;
    }

    return data;
  } catch (error) {
    console.error('[SessionsCache] Error reading cache:', error);
    return null;
  }
}

/**
 * Get cached revision number
 */
export function getCachedRevision(): number {
  if (typeof window === 'undefined') return -1;

  try {
    const revision = localStorage.getItem(REVISION_CACHE_KEY);
    return revision ? parseInt(revision, 10) : -1;
  } catch {
    return -1;
  }
}

/**
 * Save sessions to cache
 */
export function cacheSessionsData(sessions: Session[], sessionsRevision: number): void {
  if (typeof window === 'undefined') return;

  try {
    const data: CachedSessionsData = {
      sessions,
      sessionsRevision,
      cachedAt: Date.now(),
    };

    localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(REVISION_CACHE_KEY, sessionsRevision.toString());
  } catch (error) {
    console.error('[SessionsCache] Error writing cache:', error);
    // If we can't write (quota exceeded), clear the cache
    clearSessionsCache();
  }
}

/**
 * Clear the sessions cache
 */
export function clearSessionsCache(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(SESSIONS_CACHE_KEY);
    localStorage.removeItem(REVISION_CACHE_KEY);
  } catch (error) {
    console.error('[SessionsCache] Error clearing cache:', error);
  }
}

/**
 * Check if cache is valid (revision matches)
 */
export function isCacheValid(serverRevision: number): boolean {
  const cachedRevision = getCachedRevision();
  return cachedRevision === serverRevision && cachedRevision >= 0;
}

/**
 * Fetch sessions with caching strategy.
 *
 * Strategy:
 * 1. Return cached data immediately if available (for instant UI render)
 * 2. Check revision in background
 * 3. If revision matches, we're done
 * 4. If revision differs, fetch fresh data and update cache
 *
 * Returns: { sessions, fromCache, needsRefresh }
 */
export async function fetchSessionsWithCache(): Promise<{
  sessions: Session[];
  sessionsRevision: number;
  fromCache: boolean;
}> {
  const cached = getCachedSessions();

  try {
    // Always fetch the lightweight list to check revision
    const response = await fetch('/api/sessions/list');
    if (!response.ok) {
      throw new Error('Failed to fetch sessions list');
    }

    const data = await response.json();
    const serverRevision = data.sessionsRevision ?? 0;
    const serverSessions: Session[] = data.sessions || [];

    // Cache the fresh data
    cacheSessionsData(serverSessions, serverRevision);

    return {
      sessions: serverSessions,
      sessionsRevision: serverRevision,
      fromCache: false,
    };
  } catch (error) {
    console.error('[SessionsCache] Error fetching sessions:', error);

    // Return cached data if available, otherwise empty
    if (cached) {
      return {
        sessions: cached.sessions,
        sessionsRevision: cached.sessionsRevision,
        fromCache: true,
      };
    }

    return {
      sessions: [],
      sessionsRevision: 0,
      fromCache: false,
    };
  }
}

/**
 * Get cached sessions synchronously for immediate render,
 * then trigger a background refresh if needed.
 */
export function getSessionsWithOptimisticLoad(): {
  sessions: Session[];
  sessionsRevision: number;
  refreshPromise: Promise<{ sessions: Session[]; sessionsRevision: number } | null>;
} {
  const cached = getCachedSessions();

  // Create a background refresh promise
  const refreshPromise = fetchSessionsWithCache().then(result => {
    if (!result.fromCache) {
      return {
        sessions: result.sessions,
        sessionsRevision: result.sessionsRevision,
      };
    }
    return null; // No update needed
  });

  return {
    sessions: cached?.sessions || [],
    sessionsRevision: cached?.sessionsRevision || 0,
    refreshPromise,
  };
}
