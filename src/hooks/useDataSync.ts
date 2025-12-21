/**
 * Hook to initialize store data from database when user logs in
 */

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRowingStore } from '@/lib/store';
import { initializeStoreFromDB } from '@/lib/dataSync';

export function useDataSync() {
  const { data: session, status } = useSession();
  const initializeFromDB = useRowingStore((state) => state.initializeFromDB);
  const hasInitialized = useRef(false);

  useEffect(() => {
    console.log('[DATASYNC] useDataSync effect triggered:', { status, hasUser: !!session?.user, hasInitialized: hasInitialized.current });
    
    if (status === 'authenticated' && session?.user && !hasInitialized.current) {
      console.log('[DATASYNC] Initializing data from database...');
      hasInitialized.current = true;
      
      // Load data from database
      initializeFromDB();
    } else if (status === 'unauthenticated') {
      console.log('[DATASYNC] User logged out, resetting initialization flag');
      // Reset flag when user logs out
      hasInitialized.current = false;
    }
  }, [status, session, initializeFromDB]);
}
