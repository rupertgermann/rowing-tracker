import type { Session } from '@/types/session';
import {
  saveRowingSessions,
  fetchRowingSessionList,
  type RowingSessionSaveProgress,
  type RowingSessionSaveResult,
} from '@/lib/services/rowingSessionPersistence';

export interface RowingImportStoreActions {
  replaceSessionsInStore: (sessions: Session[]) => void;
  addSessions: (sessions: Session[]) => void;
  updateSessionsInStore: (sessions: Session[]) => void;
}

export type SaveRowingSessionsForImport = (
  sessions: Session[],
  options?: { onProgress?: (progress: RowingSessionSaveProgress) => void },
) => Promise<RowingSessionSaveResult>;

export interface PersistRowingImportOptions {
  onProgress?: (progress: RowingSessionSaveProgress) => void;
  saveSessions?: SaveRowingSessionsForImport;
  checkMocapOverlap?: (savedSessions: Session[]) => Promise<void>;
}

export interface SmartRowSyncPersistenceInput {
  csvSessions: Session[];
  loadZipSessions?: () => Promise<Session[]>;
  store: RowingImportStoreActions;
}

export interface SmartRowSyncPersistenceResult {
  csvResult?: RowingSessionSaveResult;
  zipResult?: RowingSessionSaveResult;
}

function savedSessionsFrom(result: RowingSessionSaveResult): Session[] {
  return result.sessions ?? [];
}

async function refreshAfterFailedImport(
  result: RowingSessionSaveResult,
  store: RowingImportStoreActions,
): Promise<RowingSessionSaveResult> {
  let recoveryMessage: string;
  try {
    // Even a lost response can follow a commit; only the server knows what was saved.
    const fresh = await fetchRowingSessionList({ cache: 'no-store' });
    store.replaceSessionsInStore(fresh.sessions);
    recoveryMessage = 'Some workouts may have been saved. Your workout list has been refreshed from the server. You can retry the import safely.';
  } catch {
    recoveryMessage = 'Some workouts may have been saved, but the server refresh failed. Your displayed workouts may be out of date. Retry when the connection is restored; already saved workouts will not be duplicated.';
  }
  return { ...result, error: `${result.error || 'Import failed'} ${recoveryMessage}` };
}

export async function persistCsvImportSessions(
  sessions: Session[],
  store: RowingImportStoreActions,
  options: PersistRowingImportOptions = {},
): Promise<RowingSessionSaveResult> {
  if (sessions.length === 0) {
    return { success: true, sessions: [] };
  }

  const saveSessions = options.saveSessions ?? saveRowingSessions;
  const result = await saveSessions(sessions, { onProgress: options.onProgress });

  if (!result.success) {
    return refreshAfterFailedImport(result, store);
  }

  const savedSessions = savedSessionsFrom(result);
  if (savedSessions.length > 0) {
    store.updateSessionsInStore(savedSessions);
    store.addSessions(savedSessions);
    await options.checkMocapOverlap?.(savedSessions);
  }

  return result;
}

export async function persistZipImportSessions(
  sessionsToSave: Session[],
  store: RowingImportStoreActions,
  options: PersistRowingImportOptions = {},
): Promise<RowingSessionSaveResult> {
  if (sessionsToSave.length === 0) {
    return { success: true, sessions: [] };
  }

  const saveSessions = options.saveSessions ?? saveRowingSessions;
  const result = await saveSessions(sessionsToSave, { onProgress: options.onProgress });

  if (!result.success) {
    return refreshAfterFailedImport(result, store);
  }

  const savedSessions = savedSessionsFrom(result);
  if (savedSessions.length > 0) {
    store.updateSessionsInStore(savedSessions);
    await options.checkMocapOverlap?.(savedSessions);
  }

  return result;
}

export async function persistSmartRowSyncImport(
  input: SmartRowSyncPersistenceInput,
  options: PersistRowingImportOptions = {},
): Promise<SmartRowSyncPersistenceResult> {
  const csvResult = await persistCsvImportSessions(input.csvSessions, input.store, options);
  if (!csvResult.success) {
    return { csvResult };
  }

  const zipSessions = input.loadZipSessions
    ? await input.loadZipSessions()
    : [];

  const zipResult = await persistZipImportSessions(zipSessions, input.store, options);

  return {
    csvResult,
    zipResult,
  };
}
