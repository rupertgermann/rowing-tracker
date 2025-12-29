'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  HardDrive
} from 'lucide-react';
import { memoryStorage } from '@/lib/memoryStorage';
import { migrateMemoryDocumentsToDatabase } from '@/lib/memorySync';

interface MigrationStats {
  indexedDBCount: number;
  databaseCount: number;
  migratedCount: number;
  failedCount: number;
}

export function MemoryMigrationCard() {
  const [stats, setStats] = useState<MigrationStats>({
    indexedDBCount: 0,
    databaseCount: 0,
    migratedCount: 0,
    failedCount: 0,
  });
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [migrationErrors, setMigrationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check migration status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        setIsLoading(true);

        // Get IndexedDB document count
        const docs = await memoryStorage.getAllDocuments();
        const indexedDBCount = docs.length;

        // Get database document count
        const response = await fetch('/api/memory/migrate', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        let databaseCount = 0;
        if (response.ok) {
          const data = await response.json();
          databaseCount = data.documentCount || 0;
        }

        setStats(prev => ({
          ...prev,
          indexedDBCount,
          databaseCount,
        }));
      } catch (error) {
        console.error('Error checking migration status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
  }, []);

  const handleMigrate = async () => {
    setIsMigrating(true);
    setMigrationErrors([]);
    setMigrationComplete(false);

    try {
      const result = await migrateMemoryDocumentsToDatabase(memoryStorage);

      setStats(prev => ({
        ...prev,
        migratedCount: result.migrated,
        failedCount: result.failed,
      }));

      if (result.errors && result.errors.length > 0) {
        setMigrationErrors(result.errors);
      }

      if (result.success) {
        setMigrationComplete(true);
        // Refresh database count
        const response = await fetch('/api/memory/migrate', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setStats(prev => ({
            ...prev,
            databaseCount: data.documentCount || 0,
          }));
        }
      }
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationErrors([error instanceof Error ? error.message : 'Unknown error']);
    } finally {
      setIsMigrating(false);
    }
  };

  const migrationProgress = stats.indexedDBCount > 0 
    ? ((stats.databaseCount / stats.indexedDBCount) * 100) 
    : 0;

  const isMigrationNeeded = stats.indexedDBCount > stats.databaseCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Memory Documents Migration
        </CardTitle>
        <CardDescription>
          Migrate your memory documents from local storage to the secure database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Checking migration status...</span>
          </div>
        ) : (
          <>
            {/* Status Overview */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Local Storage</span>
                </div>
                <div className="text-2xl font-bold">{stats.indexedDBCount}</div>
                <p className="text-xs text-muted-foreground">documents in IndexedDB</p>
              </div>

              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Database</span>
                </div>
                <div className="text-2xl font-bold">{stats.databaseCount}</div>
                <p className="text-xs text-muted-foreground">documents in database</p>
              </div>
            </div>

            {/* Migration Progress */}
            {isMigrationNeeded && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Migration Progress</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.databaseCount} of {stats.indexedDBCount}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300"
                      style={{ width: `${migrationProgress}%` }}
                    />
                  </div>
                </div>

                <Alert className="border-blue-200 bg-blue-50">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    You have {stats.indexedDBCount - stats.databaseCount} documents that need to be migrated to the database.
                    This will ensure your data is backed up and accessible across devices.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleMigrate}
                  disabled={isMigrating}
                  className="w-full"
                  size="lg"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Migrating Documents...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Migrate to Database
                    </>
                  )}
                </Button>
              </>
            )}

            {/* Migration Complete */}
            {migrationComplete && !isMigrationNeeded && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Migration Complete!</strong> All {stats.databaseCount} documents have been successfully migrated to the database.
                </AlertDescription>
              </Alert>
            )}

            {/* Already Migrated */}
            {!isMigrationNeeded && stats.databaseCount > 0 && !migrationComplete && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  All your documents are already in the database. No migration needed.
                </AlertDescription>
              </Alert>
            )}

            {/* No Documents */}
            {stats.indexedDBCount === 0 && stats.databaseCount === 0 && (
              <Alert className="border-gray-200 bg-gray-50">
                <AlertTriangle className="h-4 w-4 text-gray-600" />
                <AlertDescription className="text-gray-800">
                  You don&apos;t have any memory documents yet. Start by uploading PDFs, images, or creating notes.
                </AlertDescription>
              </Alert>
            )}

            {/* Migration Results */}
            {(stats.migratedCount > 0 || stats.failedCount > 0) && (
              <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium text-sm">Migration Results</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Successfully Migrated:</span>
                    <div className="text-lg font-bold text-green-600">{stats.migratedCount}</div>
                  </div>
                  {stats.failedCount > 0 && (
                    <div>
                      <span className="text-muted-foreground">Failed:</span>
                      <div className="text-lg font-bold text-red-600">{stats.failedCount}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Messages */}
            {migrationErrors.length > 0 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Migration Errors:</strong>
                  <ul className="mt-2 space-y-1 text-sm">
                    {migrationErrors.slice(0, 5).map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                    {migrationErrors.length > 5 && (
                      <li>• ... and {migrationErrors.length - 5} more errors</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Info */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>What happens:</strong> Your documents will be securely stored in the database with encryption.
              </p>
              <p>
                <strong>Benefits:</strong> Access your documents across devices, automatic backups, and better security.
              </p>
              <p>
                <strong>Safe:</strong> Your local copies remain intact. You can retry if something goes wrong.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
