import type { Session } from '@/types/session';
import {
  cacheSessionsData,
  getCachedSessions,
} from '@/lib/services/sessionsCache';

export interface RowingSessionListResult {
  sessions: Session[];
  revision: number;
  count: number;
  source: 'cache' | 'network' | 'stale-cache' | 'empty';
}

export interface RowingSessionListResponse {
  sessions: Session[];
  revision: number;
  count: number;
}

interface SessionsListApiResponse {
  sessions?: Session[];
  sessionsRevision?: number;
  count?: number;
}

function reviveSession(session: Session): Session {
  return {
    ...session,
    timestamp: session.timestamp instanceof Date
      ? session.timestamp
      : new Date(session.timestamp),
  };
}

export function reviveRowingSessionTimestamps(sessions: Session[]): Session[] {
  return sessions.map(reviveSession);
}

export async function fetchRowingSessionList(
  init?: RequestInit,
): Promise<RowingSessionListResponse> {
  const response = await fetch('/api/sessions/list', init);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[RowingSessionPersistence] Failed to fetch sessions list:', errorText);
    throw new Error('Failed to fetch sessions list');
  }

  const data: SessionsListApiResponse = await response.json();
  const sessions = reviveRowingSessionTimestamps(data.sessions ?? []);

  return {
    sessions,
    revision: data.sessionsRevision ?? 0,
    count: data.count ?? sessions.length,
  };
}

export async function loadRowingSessionList(
  init?: RequestInit,
): Promise<RowingSessionListResult> {
  const cached = getCachedSessions();
  const cachedSessions = cached
    ? reviveRowingSessionTimestamps(cached.sessions)
    : null;

  try {
    const fresh = await fetchRowingSessionList(init);

    if (
      cached &&
      cached.sessionsRevision === fresh.revision &&
      cachedSessions &&
      cachedSessions.length === fresh.count
    ) {
      return {
        sessions: cachedSessions,
        revision: cached.sessionsRevision,
        count: cachedSessions.length,
        source: 'cache',
      };
    }

    cacheSessionsData(fresh.sessions, fresh.revision);
    return {
      sessions: fresh.sessions,
      revision: fresh.revision,
      count: fresh.count,
      source: 'network',
    };
  } catch (error) {
    console.error('[RowingSessionPersistence] Error loading sessions:', error);

    if (cached && cachedSessions) {
      return {
        sessions: cachedSessions,
        revision: cached.sessionsRevision,
        count: cachedSessions.length,
        source: 'stale-cache',
      };
    }

    return {
      sessions: [],
      revision: 0,
      count: 0,
      source: 'empty',
    };
  }
}
