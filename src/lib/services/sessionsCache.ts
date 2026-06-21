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
  ownerKey?: string;
}

const SESSIONS_CACHE_KEY = 'rowing_sessions_cache';
const REVISION_CACHE_KEY = 'rowing_sessions_revision';
const SCOPED_SESSIONS_CACHE_PREFIX = `${SESSIONS_CACHE_KEY}:`;
const SCOPED_REVISION_CACHE_PREFIX = `${REVISION_CACHE_KEY}:`;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours max cache age

function sessionsCacheKey(ownerKey?: string): string {
  return ownerKey ? `${SCOPED_SESSIONS_CACHE_PREFIX}${ownerKey}` : SESSIONS_CACHE_KEY;
}

function revisionCacheKey(ownerKey?: string): string {
  return ownerKey ? `${SCOPED_REVISION_CACHE_PREFIX}${ownerKey}` : REVISION_CACHE_KEY;
}

/**
 * Get cached sessions from localStorage
 */
export function getCachedSessions(ownerKey?: string): CachedSessionsData | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(sessionsCacheKey(ownerKey));
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
export function getCachedRevision(ownerKey?: string): number {
  if (typeof window === 'undefined') return -1;

  try {
    const revision = localStorage.getItem(revisionCacheKey(ownerKey));
    return revision ? parseInt(revision, 10) : -1;
  } catch {
    return -1;
  }
}

/**
 * Save sessions to cache
 */
export function cacheSessionsData(
  sessions: Session[],
  sessionsRevision: number,
  ownerKey?: string,
): void {
  if (typeof window === 'undefined') return;

  try {
    const data: CachedSessionsData = {
      sessions,
      sessionsRevision,
      cachedAt: Date.now(),
      ownerKey,
    };

    localStorage.setItem(sessionsCacheKey(ownerKey), JSON.stringify(data));
    localStorage.setItem(revisionCacheKey(ownerKey), sessionsRevision.toString());
  } catch (error) {
    console.error('[SessionsCache] Error writing cache:', error);
    // If we can't write (quota exceeded), clear the cache
    clearSessionsCache(ownerKey);
  }
}

/**
 * Clear the sessions cache
 */
export function clearSessionsCache(ownerKey?: string): void {
  if (typeof window === 'undefined') return;

  try {
    if (ownerKey) {
      localStorage.removeItem(sessionsCacheKey(ownerKey));
      localStorage.removeItem(revisionCacheKey(ownerKey));
      return;
    }

    localStorage.removeItem(SESSIONS_CACHE_KEY);
    localStorage.removeItem(REVISION_CACHE_KEY);

    if (
      typeof localStorage.length === 'number' &&
      typeof localStorage.key === 'function'
    ) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (
          key?.startsWith(SCOPED_SESSIONS_CACHE_PREFIX) ||
          key?.startsWith(SCOPED_REVISION_CACHE_PREFIX)
        ) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (error) {
    console.error('[SessionsCache] Error clearing cache:', error);
  }
}

/**
 * Check if cache is valid (revision matches)
 */
export function isCacheValid(serverRevision: number, ownerKey?: string): boolean {
  const cachedRevision = getCachedRevision(ownerKey);
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
