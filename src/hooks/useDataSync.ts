/**
 * Hook to initialize store data from database when user logs in
 * Implements DB-first pattern: database is source of truth, localStorage is cache
 */

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRowingStore } from '@/lib/store';
import { settings } from '@/lib/settings';

let activeInitialization: Promise<void> | null = null;
let initializedUserId: string | null = null;

export function useDataSync() {
  const { data: session, status } = useSession();
  const initializeFromDB = useRowingStore((state) => state.initializeFromDB);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user && !hasInitialized.current) {
      hasInitialized.current = true;
      const user = session.user as { id?: string; email?: string };
      const userId = user.id ?? user.email ?? 'authenticated';

      // Initialize all data from database (DB-first pattern)
      const initializeAll = async () => {
        if (initializedUserId === userId) {
          return;
        }

        if (activeInitialization) {
          await activeInitialization;
          if (initializedUserId === userId) {
            return;
          }
        }

        activeInitialization = (async () => {
          try {
            // Initialize settings from DB first (populates localStorage cache)
            await settings.initializeFromDB();

            // Then initialize store data (sessions, awards, etc.)
            await initializeFromDB();
            initializedUserId = userId;
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
      hasInitialized.current = false;
      initializedUserId = null;
      activeInitialization = null;
    }
  }, [status, session, initializeFromDB]);
}
