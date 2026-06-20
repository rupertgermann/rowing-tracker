import type { Session } from '@/types/session';
import {
  saveRowingSessions,
  type RowingSessionSaveProgress,
  type RowingSessionSaveResult,
} from '@/lib/services/rowingSessionPersistence';

export interface RowingImportStoreActions {
  addSessions: (sessions: Session[], options?: { skipDbSave?: boolean }) => void;
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
    return result;
  }

  const savedSessions = savedSessionsFrom(result);
  if (savedSessions.length > 0) {
    store.addSessions(savedSessions, { skipDbSave: true });
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
    return result;
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
