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

export interface RowingSessionSaveResult {
  success: boolean;
  error?: string;
  sessions?: Session[];
}

export interface RowingSessionSaveProgress {
  current: number;
  total: number;
  sessionsProcessed: number;
  totalSessions: number;
  message: string;
}

export interface SaveRowingSessionsOptions {
  onProgress?: (progress: RowingSessionSaveProgress) => void;
  chunkSize?: number;
  fetchImpl?: typeof fetch;
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

export function invalidateRowingSessionCaches(): void {
  clearSessionsCache();
  clearAnalyticsCache();
}

function sessionTimestampMs(session: Session): number {
  return session.timestamp instanceof Date
    ? session.timestamp.getTime()
    : new Date(session.timestamp).getTime();
}

function findSubmittedSessionForSaved(
  savedSession: Session,
  submittedSessions: Session[],
): Session | undefined {
  const byId = submittedSessions.find((session) => session.id === savedSession.id);
  if (byId) return byId;

  const savedTimestamp = sessionTimestampMs(savedSession);
  return submittedSessions.find((session) =>
    Math.abs(sessionTimestampMs(session) - savedTimestamp) < 1000 &&
    session.distance === savedSession.distance
  );
}

function mergeSavedSessionsWithSubmittedMetadata(
  savedSessions: Session[],
  submittedSessions: Session[],
): Session[] {
  return reviveRowingSessionTimestamps(savedSessions).map((savedSession) => {
    const submittedSession = findSubmittedSessionForSaved(savedSession, submittedSessions);

    return {
      ...submittedSession,
      ...savedSession,
      strokeData: savedSession.strokeData ?? submittedSession?.strokeData,
      mocapSession: 'mocapSession' in savedSession
        ? savedSession.mocapSession
        : submittedSession?.mocapSession,
    };
  });
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

export async function saveRowingSessions(
  sessions: Session[],
  options: SaveRowingSessionsOptions = {},
): Promise<RowingSessionSaveResult> {
  if (sessions.length === 0) {
    return { success: true, sessions: [] };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const chunkSize = options.chunkSize ?? 25;
  const totalChunks = Math.ceil(sessions.length / chunkSize);
  let sessionsProcessed = 0;
  const savedSessions: Session[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, sessions.length);
    const chunk = sessions.slice(start, end);

    options.onProgress?.({
      current: i + 1,
      total: totalChunks,
      sessionsProcessed,
      totalSessions: sessions.length,
      message: `Processing sessions ${start + 1}-${end} of ${sessions.length}...`,
    });

    try {
      const response = await fetchImpl('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: chunk }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error(`[RowingSessionPersistence] Save chunk ${i + 1}/${totalChunks} failed:`, error);
        return {
          success: false,
          error: `Failed at chunk ${i + 1}/${totalChunks}: ${error.error || 'Unknown error'}`,
        };
      }

      const data = await response.json();
      savedSessions.push(...mergeSavedSessionsWithSubmittedMetadata(data.sessions ?? [], chunk));

      sessionsProcessed += chunk.length;
    } catch (error) {
      console.error(`[RowingSessionPersistence] Error saving chunk ${i + 1}/${totalChunks}:`, error);
      return {
        success: false,
        error: `Network error at chunk ${i + 1}/${totalChunks}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  options.onProgress?.({
    current: totalChunks,
    total: totalChunks,
    sessionsProcessed: sessions.length,
    totalSessions: sessions.length,
    message: 'Upload complete!',
  });

  invalidateRowingSessionCaches();

  return {
    success: true,
    sessions: savedSessions,
  };
}
