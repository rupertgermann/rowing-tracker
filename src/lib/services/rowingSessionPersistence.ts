import type { Session } from '@/types/session';
import { clearAnalyticsCache } from '@/lib/services/analyticsCache';
import {
  cacheSessionsData,
  clearSessionsCache,
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

interface RowingSessionMutationApiResponse {
  sessions?: Session[];
  sessionId?: string;
  error?: string;
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

function clearRowingSessionCaches(): void {
  clearSessionsCache();
  clearAnalyticsCache();
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

export async function saveRowingSession(
  session: Session,
  init?: RequestInit,
): Promise<Session> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  const response = await fetch('/api/sessions', {
    ...init,
    method: 'POST',
    headers,
    body: JSON.stringify({ sessions: [session] }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[RowingSessionPersistence] Failed to save session:', errorText);
    throw new Error('Failed to save rowing session');
  }

  const data: RowingSessionMutationApiResponse = await response.json();
  const persisted = data.sessions?.[0]
    ? reviveSession(data.sessions[0])
    : reviveSession(session);

  clearRowingSessionCaches();

  return {
    ...session,
    ...persisted,
    ...(Array.isArray(session.strokeData)
      ? {
          strokeData: session.strokeData,
          strokeDataCount: session.strokeData.length,
        }
      : {}),
  };
}

export async function saveRowingSessionStrokeData(
  session: Session,
  strokeData: NonNullable<Session['strokeData']>,
): Promise<Session> {
  return saveRowingSession({
    ...session,
    strokeData,
    strokeDataCount: strokeData.length,
  });
}

export async function clearRowingSessionStrokeData(
  session: Session,
): Promise<Session> {
  const persisted = await saveRowingSession({
    ...session,
    strokeData: [],
    strokeDataCount: 0,
    consistencyScore: null,
  });

  return {
    ...persisted,
    strokeData: undefined,
    strokeDataCount: 0,
    consistencyScore: persisted.consistencyScore ?? null,
  };
}

export async function deleteRowingSession(
  sessionId: string,
  init?: RequestInit,
): Promise<string> {
  const response = await fetch(`/api/sessions?id=${encodeURIComponent(sessionId)}`, {
    ...init,
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[RowingSessionPersistence] Failed to delete session:', errorText);
    throw new Error('Failed to delete rowing session');
  }

  const data: RowingSessionMutationApiResponse = await response.json();
  clearRowingSessionCaches();

  return data.sessionId ?? sessionId;
}
