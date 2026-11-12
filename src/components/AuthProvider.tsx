"use client";

import { useEffect, useState, useSyncExternalStore } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { useDataSync } from '@/hooks/useDataSync';
import { ACCOUNT_OWNER_KEY, createAccountBoundary } from '@/lib/accountBoundary';

function DataSyncWrapper({ children }: { children: React.ReactNode }) {
  useDataSync();
  return <>{children}</>;
}

const serverSnapshot = () => undefined;
const serverSubscribe = () => () => {};

function AccountBoundary({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [boundary] = useState(() => typeof window === 'undefined' ? null : createAccountBoundary(window));
  const readyOwner = useSyncExternalStore(boundary?.subscribe ?? serverSubscribe, boundary?.getSnapshot ?? serverSnapshot, serverSnapshot);
  const owner = status === 'loading' ? undefined : session?.user?.id ?? '';

  useEffect(() => {
    if (!boundary || owner === undefined) return;
    if (boundary.enter(owner)) {
      window.location.reload();
      return;
    }
  }, [boundary, owner]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== ACCOUNT_OWNER_KEY || event.newValue === readyOwner) return;
      boundary?.retire();
      window.location.reload();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [boundary, readyOwner]);

  if (owner === undefined || readyOwner !== owner) return null;
  return <DataSyncWrapper>{children}</DataSyncWrapper>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={60}>
      <AccountBoundary>{children}</AccountBoundary>
    </SessionProvider>
  );
}
