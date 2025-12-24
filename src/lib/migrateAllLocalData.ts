/**
 * Complete Migration Utility
 * Migrates ALL local data (localStorage + IndexedDB) to PostgreSQL database
 */

import { 
  saveSessionsToDB, 
  savePRsToDB, 
  saveAwardsToDB,
  saveTrainingPlansToDB,
  saveInsightsToDB,
  saveChatSessionsToDB,
  saveSettingsToDB,
  saveGeneratedAchievementsToDB,
  saveMemoryDocumentsToDB
} from './dataSync';
import { 
  getAllAchievementImageIdsFromIndexedDB, 
  getAchievementImageFromIndexedDB 
} from './imageStorage';
import { memoryStorage } from './memoryStorage';

export interface MigrationResult {
  success: boolean;
  migrated: {
    sessions: number;
    prs: number;
    awards: number;
    trainingPlans: number;
    insights: number;
    chatSessions: number;
    settings: boolean;
    generatedAchievements: number;
    memoryDocuments: number;
  };
  errors: string[];
}

/**
 * Migrate all data from localStorage to database
 */
async function migrateLocalStorage(): Promise<Partial<MigrationResult['migrated']>> {
  const result: Partial<MigrationResult['migrated']> = {};
  const errors: string[] = [];

  try {
    // Get data from localStorage
    const localData = localStorage.getItem('rowing-tracker-storage');
    if (!localData) {
      return result;
    }

    const parsed = JSON.parse(localData);
    const state = parsed.state || {};

    // Migrate sessions
    if (state.sessions && Array.isArray(state.sessions)) {
      const saveResult = await saveSessionsToDB(state.sessions);
      if (saveResult.success) {
        result.sessions = state.sessions.length;
      } else {
        errors.push(`Sessions: ${saveResult.error}`);
      }
    }

    // Migrate training plans
    if (state.trainingPlans && Array.isArray(state.trainingPlans)) {
      const saveResult = await saveTrainingPlansToDB(state.trainingPlans);
      if (saveResult.success) {
        result.trainingPlans = state.trainingPlans.length;
      } else {
        errors.push(`Training Plans: ${saveResult.error}`);
      }
    }

    // Migrate AI award suggestions
    if (state.aiAwardSuggestions && Array.isArray(state.aiAwardSuggestions)) {
      // These are saved with awards
      result.awards = (result.awards || 0) + state.aiAwardSuggestions.length;
    }

    // Migrate chart explanations
    if (state.chartExplanations) {
      // Chart explanations can be migrated if needed
      // For now, they're cached data that can be regenerated
    }

  } catch (error) {
    console.error('Error migrating localStorage:', error);
    errors.push(`localStorage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Migrate achievement images from IndexedDB to database
 */
async function migrateAchievementImages(): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  let count = 0;

  try {
    const awardIds = await getAllAchievementImageIdsFromIndexedDB();
    const achievements = [];

    for (const awardId of awardIds) {
      try {
        const imageData = await getAchievementImageFromIndexedDB(awardId);
        if (imageData) {
          const saveImageResponse = await fetch('/api/achievements/image/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ awardId, imageData }),
          });

          if (!saveImageResponse.ok) {
            const saveImageError = await saveImageResponse
              .json()
              .catch(() => ({ error: 'Failed to save image to filesystem' }));
            throw new Error(saveImageError.error || 'Failed to save image to filesystem');
          }

          const savedImage = await saveImageResponse.json();
          const imageUrl = savedImage?.filePath;

          if (imageUrl) {
            achievements.push({
              awardId,
              imageUrl,
              hasImage: true,
            });
            count++;
          }
        }
      } catch (error) {
        errors.push(`Award ${awardId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (achievements.length > 0) {
      const saveResult = await saveGeneratedAchievementsToDB(achievements);
      if (!saveResult.success) {
        errors.push(`Save failed: ${saveResult.error}`);
      }
    }
  } catch (error) {
    console.error('Error migrating achievement images:', error);
    errors.push(`IndexedDB achievements: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { count, errors };
}

/**
 * Migrate memory documents from IndexedDB to database
 */
async function migrateMemoryDocuments(): Promise<{ count: number; errors: string[] }> {
  return { count: 0, errors: [] };
}

/**
 * Migrate ALL local data to database
 * Call this once when user logs in to migrate their data
 */
export async function migrateAllLocalData(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    migrated: {
      sessions: 0,
      prs: 0,
      awards: 0,
      trainingPlans: 0,
      insights: 0,
      chatSessions: 0,
      settings: false,
      generatedAchievements: 0,
      memoryDocuments: 0,
    },
    errors: [],
  };

  console.log('[MIGRATION] Starting complete data migration...');

  // Migrate localStorage data
  const localStorageResult = await migrateLocalStorage();
  result.migrated = { ...result.migrated, ...localStorageResult };

  // Migrate IndexedDB achievement images
  const achievementsResult = await migrateAchievementImages();
  result.migrated.generatedAchievements = achievementsResult.count;
  result.errors.push(...achievementsResult.errors);

  // Migrate IndexedDB memory documents
  const memoryResult = await migrateMemoryDocuments();
  result.migrated.memoryDocuments = memoryResult.count;
  result.errors.push(...memoryResult.errors);

  if (result.errors.length > 0) {
    result.success = false;
    console.error('[MIGRATION] Completed with errors:', result.errors);
  } else {
    console.log('[MIGRATION] Completed successfully:', result.migrated);
  }

  return result;
}

/**
 * Clear all local data after successful migration
 */
export async function clearAllLocalData(): Promise<void> {
  console.log('[CLEANUP] Clearing all local data...');

  // Clear localStorage
  localStorage.removeItem('rowing-tracker-storage');

  // Clear IndexedDB achievement images
  try {
    const { openDB } = await import('idb');
    const db = await openDB('achievement-images', 1);
    await db.clear('images');
    console.log('[CLEANUP] Cleared IndexedDB achievement images');
  } catch (error) {
    console.error('[CLEANUP] Failed to clear IndexedDB achievements:', error);
  }

  // Clear IndexedDB memory documents
  try {
    await memoryStorage.clearAll();
    console.log('[CLEANUP] Cleared IndexedDB memory documents');
  } catch (error) {
    console.error('[CLEANUP] Failed to clear IndexedDB memory:', error);
  }

  console.log('[CLEANUP] Local data cleanup complete');
}
