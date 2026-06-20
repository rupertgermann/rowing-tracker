/**
 * Hook to initialize store data from database when user logs in
 * Implements DB-first pattern: database is source of truth, localStorage is cache
 */

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRowingStore } from '@/lib/store';

let activeInitialization: Promise<void> | null = null;
const loadedRequirementsByUser = new Map<string, Set<DataRequirement>>();

export type DataSyncScope = 'dashboard' | 'sessions' | 'prs';
type DataRequirement = 'sessions' | 'awards' | 'settings' | 'generatedAchievements';

const requirementsByScope: Record<DataSyncScope, DataRequirement[]> = {
  dashboard: ['sessions'],
  sessions: ['sessions'],
  prs: ['sessions'],
};

function getMissingRequirements(userId: string, scope: DataSyncScope) {
  const loaded = loadedRequirementsByUser.get(userId) ?? new Set<DataRequirement>();
  return requirementsByScope[scope].filter((requirement) => !loaded.has(requirement));
}

function markRequirementsLoaded(userId: string, requirements: DataRequirement[]) {
  const loaded = loadedRequirementsByUser.get(userId) ?? new Set<DataRequirement>();
  requirements.forEach((requirement) => loaded.add(requirement));
  loadedRequirementsByUser.set(userId, loaded);
}

export function useDataSync(scope: DataSyncScope = 'dashboard') {
  const { status } = useSession();
  const initializeFromDB = useRowingStore((state) => state.initializeFromDB);

  useEffect(() => {
    if (status !== 'unauthenticated') {
      const userId = 'authenticated';

      // Initialize all data from database (DB-first pattern)
      const initializeAll = async () => {
        let missingRequirements = getMissingRequirements(userId, scope);
        if (missingRequirements.length === 0) {
          return;
        }

        if (activeInitialization) {
          await activeInitialization;
          missingRequirements = getMissingRequirements(userId, scope);
          if (missingRequirements.length === 0) {
            return;
          }
        }

        activeInitialization = (async () => {
          try {
            await initializeFromDB({
              includeSessions: missingRequirements.includes('sessions'),
              includeAwards: missingRequirements.includes('awards'),
              includeSettings: missingRequirements.includes('settings'),
              includeGeneratedAchievements: missingRequirements.includes('generatedAchievements'),
            });
            markRequirementsLoaded(userId, missingRequirements);
          } catch (error) {
            console.error('[DATASYNC] Error during initialization:', error);
          } finally {
            activeInitialization = null;
          }
        })();

        await activeInitialization;
      };

      initializeAll();
    } else if (status === 'unauthenticated') {
      // Reset flag when user logs out
      loadedRequirementsByUser.clear();
      activeInitialization = null;
    }
  }, [status, initializeFromDB, scope]);
}
