/**
 * Hook to initialize store data from database when user logs in
 * Implements DB-first pattern: database is source of truth, localStorage is cache
 */

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRowingStore } from '@/lib/store';
import { settings } from '@/lib/settings';

export function useDataSync() {
  const { data: session, status } = useSession();
  const initializeFromDB = useRowingStore((state) => state.initializeFromDB);
  const hasInitialized = useRef(false);

  useEffect(() => {
    console.log('[DATASYNC] useDataSync effect triggered:', { status, hasUser: !!session?.user, hasInitialized: hasInitialized.current });
    
    if (status === 'authenticated' && session?.user && !hasInitialized.current) {
      console.log('[DATASYNC] Initializing data from database...');
      hasInitialized.current = true;
      
      // Initialize all data from database (DB-first pattern)
      const initializeAll = async () => {
        try {
          // Initialize settings from DB first (populates localStorage cache)
          await settings.initializeFromDB();
          console.log('[DATASYNC] Settings initialized from DB');
          
          // Then initialize store data (sessions, awards, etc.)
          await initializeFromDB();
          console.log('[DATASYNC] Store data initialized from DB');
        } catch (error) {
          console.error('[DATASYNC] Error during initialization:', error);
        }
      };
      
      initializeAll();
    } else if (status === 'unauthenticated') {
      console.log('[DATASYNC] User logged out, resetting initialization flag');
      // Reset flag when user logs out
      hasInitialized.current = false;
    }
  }, [status, session, initializeFromDB]);
}
