"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Database, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { hasPendingMigration, migrateLocalStorageToDatabase, clearLocalStorageData, MigrationResult } from "@/lib/migrateLocalStorage";

export function MigrationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const hasPending = hasPendingMigration();
    const wasDismissed = localStorage.getItem('migrationDismissed') === 'true';
    setShowPrompt(hasPending && !wasDismissed);
  }, []);

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      const migrationResult = await migrateLocalStorageToDatabase();
      setResult(migrationResult);
      
      if (migrationResult.success) {
        setTimeout(() => {
          setShowPrompt(false);
        }, 5000);
      }
    } catch (error) {
      console.error('Migration failed:', error);
      setResult({
        success: false,
        migratedSessions: 0,
        migratedPRs: 0,
        migratedPlans: 0,
        migratedAwards: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('migrationDismissed', 'true');
    setDismissed(true);
    setShowPrompt(false);
  };

  const handleClearLocalStorage = () => {
    if (confirm('Are you sure you want to clear all localStorage data? This cannot be undone.')) {
      clearLocalStorageData();
      setShowPrompt(false);
    }
  };

  if (!showPrompt || dismissed) return null;

  return (
    <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <Database className="h-6 w-6 text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2">
            Migrate Your Data to Database
          </h3>
          
          {!result ? (
            <>
              <p className="text-slate-300 mb-4">
                We detected data stored in your browser&apos;s localStorage from the previous single-user version. 
                Would you like to migrate this data to your user account in the database?
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleMigrate}
                  disabled={isMigrating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Migrating...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Migrate Data
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  disabled={isMigrating}
                  className="border-slate-600 text-slate-300"
                >
                  Remind Me Later
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {result.success ? (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Migration completed successfully!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">Migration completed with errors</span>
                </div>
              )}
              
              <div className="bg-slate-800/50 rounded p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Sessions migrated:</span>
                  <span className="text-white font-medium">{result.migratedSessions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Personal Records migrated:</span>
                  <span className="text-white font-medium">{result.migratedPRs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Training Plans migrated:</span>
                  <span className="text-white font-medium">{result.migratedPlans}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Awards migrated:</span>
                  <span className="text-white font-medium">{result.migratedAwards}</span>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/50 rounded p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                    <div className="text-sm text-red-300">
                      <p className="font-medium mb-1">Errors:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {result.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {result.success && (
                <div className="pt-2">
                  <p className="text-slate-400 text-sm mb-3">
                    Your data has been migrated to the database. You can now safely clear the old localStorage data.
                  </p>
                  <Button
                    onClick={handleClearLocalStorage}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300"
                  >
                    Clear localStorage Data
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
