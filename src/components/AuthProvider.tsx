"use client";

import { SessionProvider } from "next-auth/react";
import { useDataSync } from "@/hooks/useDataSync";

interface AuthProviderProps {
  children: React.ReactNode;
}

function DataSyncWrapper({ children }: { children: React.ReactNode }) {
  useDataSync();
  return <>{children}</>;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider>
      <DataSyncWrapper>
        {children}
      </DataSyncWrapper>
    </SessionProvider>
  );
}
