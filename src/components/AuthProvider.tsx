"use client";

import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useDataSync, type DataSyncScope } from "@/hooks/useDataSync";

interface AuthProviderProps {
  children: React.ReactNode;
}

function DataSyncWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const syncScope: DataSyncScope =
    pathname === "/sessions" ? "sessions" :
      pathname.startsWith("/prs") ? "prs" :
        "dashboard";
  const needsRowingStoreData =
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname === "/sessions" ||
    pathname.startsWith("/prs");

  if (pathname.startsWith("/auth") || !needsRowingStoreData) {
    return <>{children}</>;
  }

  return (
    <DataSyncBoundary scope={syncScope}>
      {children}
    </DataSyncBoundary>
  );
}

function DataSyncBoundary({ children, scope }: { children: React.ReactNode; scope: DataSyncScope }) {
  useDataSync(scope);
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
