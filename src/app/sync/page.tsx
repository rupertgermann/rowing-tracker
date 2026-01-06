'use client';

import { useState, useCallback } from 'react';
import { useRowingStore } from '@/lib/store';
import { parseSmartRowCsv, validateSmartRowCsv } from '@/lib/csvParser';
import { processZipFile, ZipImportResult, ZipProcessProgress } from '@/lib/zipParser';
import { formatValidationErrors, hasCriticalErrors } from '@/lib/validation';
import { ImportResult, Session } from '@/types/session';
import { saveSessionsToDBChunked, UploadProgress } from '@/lib/dataSync';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, AlertCircle, CheckCircle, ArrowRight, FileArchive, Database, RefreshCw, Settings } from 'lucide-react';
import Link from 'next/link';

type UploadState = 'idle' | 'dragging' | 'validating' | 'processing' | 'saving' | 'syncing' | 'success' | 'error';

export default function UploadPage() {
  const { addSessions, getSessions, updateSessionsInStore } = useRowingStore();
  const { settings, isLoading: isSettingsLoading, updateSmartRowSettings } = useSettings();
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [zipResult, setZipResult] = useState<ZipImportResult | null>(null);
  const [error, setError] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [zipProgress, setZipProgress] = useState<ZipProcessProgress | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>('');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadState === 'idle') {
      setUploadState('dragging');
    }
  }, [uploadState]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadState === 'dragging') {
      setUploadState('idle');
    }
  }, [uploadState]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (uploadState !== 'dragging') return;

    const files = e.dataTransfer.files;
    if (files.length === 0) {
      setUploadState('idle');
      return;
    }

    const file = files[0];
    processFile(file);
  }, [uploadState]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    processFile(file);
  }, []);

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setError('');
    setUploadState('validating');
    setImportResult(null);
    setZipResult(null);
    setUploadProgress(null);
    setZipProgress(null);

    try {
      // Check if it's a ZIP file
      if (file.name.toLowerCase().endsWith('.zip')) {
        setUploadState('processing');
        const existingSessions = getSessions();

        // Process ZIP file - this parses all CSVs and returns sessions to save
        const result = await processZipFile(
          file,
          existingSessions,
          (progress) => setZipProgress(progress)
        );

        // If we have sessions to save, do a chunked bulk save
        if (result.sessionsToSave.length > 0) {
          setUploadState('saving');
          setZipProgress(null);  // Clear ZIP progress
          setUploadProgress({
            current: 0,
            total: 1,
            sessionsProcessed: 0,
            totalSessions: result.sessionsToSave.length,
            message: 'Saving stroke data to database...'
          });

          // Save to database with progress tracking
          const saveResult = await saveSessionsToDBChunked(
            result.sessionsToSave,
            (progress) => setUploadProgress(progress)
          );

          if (!saveResult.success) {
            setError(saveResult.error || 'Failed to save sessions to database');
            setUploadState('error');
            return;
          }

          // Update local store state with sessions returned from database (with correct CUIDs)
          // skip DB save since we already saved with chunked upload
          if (saveResult.sessions && saveResult.sessions.length > 0) {
            updateSessionsInStore(saveResult.sessions);
          }
        }

        setZipResult(result);
        setUploadState('success');
        return;
      }

      // Validate CSV file format
      const validation = await validateSmartRowCsv(file);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid file format');
        setUploadState('error');
        return;
      }

      setUploadState('processing');

      // Parse CSV and import data
      const existingSessions = getSessions();
      const { sessions, result } = await parseSmartRowCsv(file, existingSessions);

      if (result.errors.length > 0 && hasCriticalErrors(result.errors.map(e => ({ message: e })))) {
        setError(formatValidationErrors(result.errors.map(e => ({ message: e }))).join('\n'));
        setUploadState('error');
        return;
      }

      // Save sessions to database with progress tracking
      if (result.importedSessions > 0) {
        setUploadState('saving');
        setUploadProgress({
          current: 0,
          total: 1,
          sessionsProcessed: 0,
          totalSessions: sessions.length,
          message: 'Preparing to save sessions...'
        });

        // Save to database with progress tracking
        const saveResult = await saveSessionsToDBChunked(
          sessions,
          (progress) => setUploadProgress(progress)
        );

        if (!saveResult.success) {
          setError(saveResult.error || 'Failed to save sessions to database');
          setUploadState('error');
          return;
        }

        // Update local store state with sessions returned from database (with correct CUIDs)
        // skip DB save since we already saved with chunked upload
        if (saveResult.sessions && saveResult.sessions.length > 0) {
          addSessions(saveResult.sessions, { skipDbSave: true });
        }
      }

      setImportResult(result);
      setUploadState('success');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setUploadState('error');
    }
  };

  const resetUpload = useCallback(() => {
    setUploadState('idle');
    setSelectedFile(null);
    setImportResult(null);
    setZipResult(null);
    setError('');
    setSyncMessage('');
    setUploadProgress(null);
    setZipProgress(null);
  }, []);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)}km`;
    }
    return `${meters}m`;
  };

  const handleSmartRowSync = async () => {
    // Wait for settings to be initialized
    if (isSettingsLoading || !settings) {
      setError('Settings are still loading. Please wait...');
      return;
    }

    const smartRowSettings = settings.smartRowSettings;

    if (!smartRowSettings.email || !smartRowSettings.password) {
      setError('Please configure your SmartRow credentials in Settings first.');
      setSyncMessage('');
      setUploadState('error');
      return;
    }

    setUploadState('syncing');
    setError('');
    setSyncMessage('Connecting to SmartRow...');
    setImportResult(null);
    setZipResult(null);
    setUploadProgress(null);
    setZipProgress(null);

    try {
      setSyncMessage('Logging in and downloading workouts...');

      const response = await fetch('/api/smartrow/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: smartRowSettings.email,
          password: smartRowSettings.password,
        }),
      });

      const data = await response.json();
      console.log('Sync response received:', { success: data.success, csvLength: data.csvData?.length, zipLength: data.zipData?.length });
      if (data.csvData) {
        console.log('First 500 chars of CSV data:', data.csvData.substring(0, 500));
        const csvLines = data.csvData.split('\n');
        console.log('CSV headers:', csvLines[0]);
        console.log('CSV first 3 lines:', csvLines.slice(0, 3).join('\n'));
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to sync from SmartRow');
      }

      // Update last sync time
      updateSmartRowSettings({ lastSync: new Date() });

      let totalImported = 0;
      let totalUpdated = 0;
      const existingSessions = getSessions();
      console.log(`Starting processing with ${existingSessions.length} existing sessions in store.`);

      // Process CSV data if available
      if (data.csvData) {
        console.group('Processing CSV Data');
        setSyncMessage('Processing CSV data...');
        const csvBlob = new Blob([data.csvData], { type: 'text/csv' });
        const csvFile = new File([csvBlob], 'smartrow-workouts.csv', { type: 'text/csv' });

        const validation = await validateSmartRowCsv(csvFile);
        console.log('CSV Validation:', validation);

        if (validation.isValid) {
          const { sessions, result } = await parseSmartRowCsv(csvFile, existingSessions);
          console.log(`Parsed ${sessions.length} sessions from CSV. Result stats:`, result);

          if (result.importedSessions > 0) {
            setUploadState('saving');
            setUploadProgress({
              current: 0,
              total: 1,
              sessionsProcessed: 0,
              totalSessions: sessions.length,
              message: 'Saving sessions to database...'
            });

            const saveResult = await saveSessionsToDBChunked(
              sessions,
              (progress) => setUploadProgress(progress)
            );
            console.log('DB Save Result (CSV):', saveResult);

            if (saveResult.success) {
              addSessions(sessions, { skipDbSave: true });
              totalImported += result.importedSessions;
            }
          } else {
            console.log('No new sessions to import from CSV (all duplicates or invalid).');
          }
        }
        console.groupEnd();
      }

      // Process ZIP data if available
      if (data.zipData) {
        console.group('Processing ZIP Data');
        setSyncMessage('Processing workout details...');
        const zipBuffer = Uint8Array.from(atob(data.zipData), c => c.charCodeAt(0));
        const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });
        const zipFile = new File([zipBlob], 'smartrow-workouts.zip', { type: 'application/zip' });
        console.log(`Created ZIP file of size: ${zipFile.size} bytes`);

        const updatedExistingSessions = getSessions();
        const zipResult = await processZipFile(
          zipFile,
          updatedExistingSessions,
          (progress) => setZipProgress(progress)
        );
        console.log('ZIP Processing Result:', zipResult);

        if (zipResult.sessionsToSave.length > 0) {
          setUploadState('saving');
          const saveResult = await saveSessionsToDBChunked(
            zipResult.sessionsToSave,
            (progress) => setUploadProgress(progress)
          );
          console.log('DB Save Result (ZIP):', saveResult);

          if (saveResult.success) {
            updateSessionsInStore(zipResult.sessionsToSave);
            totalUpdated += zipResult.updatedSessions;
          }
        } else {
          console.log('No sessions to save from ZIP.');
        }
        console.groupEnd();
      }

      setImportResult({
        totalRows: totalImported,
        importedSessions: totalImported,
        duplicatesSkipped: 0,
        totalDistance: 0,
        totalTime: 0,
        errors: []
      });

      setSyncMessage(`Sync complete! ${totalImported > 0 ? `Imported ${totalImported} new sessions.` : ''} ${totalUpdated > 0 ? `Updated ${totalUpdated} sessions with detailed data.` : ''}`);
      setUploadState('success');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setSyncMessage('');
      setUploadState('error');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center space-y-2 py-4">
          <h1 className="text-4xl font-bold text-foreground">Sync SmartRow Data</h1>
          <p className="text-muted-foreground text-lg">
            Sync your workouts directly from SmartRow or manually upload your data files
          </p>
        </div>

        {/* Upload Area */}
        {uploadState === 'idle' || uploadState === 'dragging' ? (
          <>
            {/* SmartRow Sync Button */}
            <Card className="border-2 border-primary/20 bg-primary/5">
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center gap-6 text-center">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-semibold text-foreground">Sync from SmartRow</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Automatically download your latest workouts from smartrow.fit. This is the recommended way to keep your data up to date.
                    </p>
                  </div>

                  <Button onClick={handleSmartRowSync} size="lg" className="h-12 px-8 text-lg shrink-0">
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Sync Now
                  </Button>

                  <p className="text-sm text-muted-foreground">
                    Configure your SmartRow credentials in{' '}
                    <Link href="/settings" className="text-primary hover:underline inline-flex items-center gap-1">
                      <Settings className="h-3 w-3" />
                      Settings
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-border" />
              <span className="text-muted-foreground text-sm uppercase tracking-wider font-medium">or manually upload</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Manual Upload Area */}
            <Card className={`border-2 border-dashed transition-colors ${uploadState === 'dragging'
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
              }`}>
              <CardContent
                className="p-8 text-center cursor-pointer"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <div className="flex flex-col items-center space-y-4">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground">
                      {uploadState === 'dragging' ? 'Drop your file here' : 'Manual File Upload'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Drag and drop your CSV or ZIP file here, or click to browse
                    </p>
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    accept=".csv,.zip"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>
          </>
        ) : uploadState === 'syncing' || uploadState === 'validating' || uploadState === 'processing' || uploadState === 'saving' ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center space-y-4">
                {uploadState === 'saving' ? (
                  <Database className="h-12 w-12 text-primary animate-pulse" />
                ) : (
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                )}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    {uploadState === 'syncing'
                      ? 'Syncing from SmartRow...'
                      : uploadState === 'validating'
                        ? 'Validating file...'
                        : uploadState === 'processing'
                          ? 'Processing your data...'
                          : 'Saving to database...'}
                  </h3>
                  <p className="text-muted-foreground">
                    {uploadState === 'syncing'
                      ? (syncMessage || 'Connecting to SmartRow...')
                      : uploadState === 'validating'
                        ? 'Checking file format'
                        : uploadState === 'processing'
                          ? 'Parsing your rowing data and calculating statistics'
                          : uploadProgress?.message || 'Uploading your sessions to the server'
                    }
                  </p>
                </div>

                {/* Progress bar for saving state */}
                {uploadState === 'saving' && uploadProgress && (
                  <div className="w-full max-w-md space-y-2">
                    <Progress
                      value={(uploadProgress.sessionsProcessed / uploadProgress.totalSessions) * 100}
                      className="h-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Sessions: {uploadProgress.sessionsProcessed} / {uploadProgress.totalSessions}</span>
                      <span>Chunk {uploadProgress.current} / {uploadProgress.total}</span>
                    </div>
                  </div>
                )}

                {/* Progress bar for ZIP processing */}
                {uploadState === 'processing' && zipProgress && (
                  <div className="w-full max-w-md space-y-2">
                    <Progress
                      value={(zipProgress.current / zipProgress.total) * 100}
                      className="h-2"
                    />
                    <div className="text-xs text-muted-foreground text-center">
                      {zipProgress.message}
                    </div>
                  </div>
                )}

                {selectedFile && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    {selectedFile.name.endsWith('.zip') ? (
                      <FileArchive className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <span>{selectedFile.name}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : uploadState === 'error' ? (
          <Card className="border-destructive">
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center space-y-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">Upload Failed</h3>
                  <p className="text-muted-foreground">
                    There was an error processing your file
                  </p>
                </div>
                {error && (
                  <div className="bg-destructive/10 p-4 rounded-lg max-w-md">
                    <p className="text-sm text-destructive whitespace-pre-line">
                      {error}
                    </p>
                  </div>
                )}
                <div className="flex space-x-3">
                  <Button onClick={resetUpload} variant="outline">
                    Try Again
                  </Button>
                  <Button
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    Choose Different File
                  </Button>
                </div>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>
        ) : uploadState === 'success' ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center space-y-6">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-foreground">Upload Successful!</h3>
                  <p className="text-muted-foreground text-lg">
                    Your rowing data has been processed successfully
                  </p>
                </div>

                {/* Import Statistics - CSV */}
                {importResult && (
                  <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                    <div className="bg-primary/10 p-4 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{importResult.importedSessions}</p>
                      <p className="text-sm text-muted-foreground">Sessions Imported</p>
                    </div>
                    {importResult.duplicatesSkipped > 0 && (
                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-2xl font-bold text-muted-foreground">{importResult.duplicatesSkipped}</p>
                        <p className="text-sm text-muted-foreground">Duplicates Skipped</p>
                      </div>
                    )}
                    <div className="bg-primary/10 p-4 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{formatDistance(importResult.totalDistance)}</p>
                      <p className="text-sm text-muted-foreground">Total Distance</p>
                    </div>
                    <div className="bg-primary/10 p-4 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{formatDuration(importResult.totalTime)}</p>
                      <p className="text-sm text-muted-foreground">Total Time</p>
                    </div>
                  </div>
                )}

                {/* Import Statistics - ZIP */}
                {zipResult && (
                  <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                    <div className="bg-primary/10 p-4 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{zipResult.updatedSessions}</p>
                      <p className="text-sm text-muted-foreground">Sessions Updated</p>
                    </div>
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-2xl font-bold text-muted-foreground">{zipResult.skippedFiles}</p>
                      <p className="text-sm text-muted-foreground">Files Skipped</p>
                    </div>
                    <div className="col-span-2 bg-primary/5 p-4 rounded-lg">
                      <p className="text-lg font-medium">
                        Processed {zipResult.processedFiles} of {zipResult.totalFiles} files
                      </p>
                    </div>
                  </div>
                )}

                {/* Non-critical errors */}
                {importResult?.errors && importResult.errors.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg max-w-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Some rows had minor issues and were skipped. Check your data for any formatting problems.
                    </p>
                  </div>
                )}

                {zipResult?.errors && zipResult.errors.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg max-w-md text-left max-h-32 overflow-y-auto">
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Issues encountered:</p>
                    <ul className="list-disc list-inside text-xs text-yellow-800 dark:text-yellow-200">
                      {zipResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {zipResult.errors.length > 5 && (
                        <li>...and {zipResult.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <Button onClick={resetUpload} variant="outline">
                    Upload Another File
                  </Button>
                  <Button asChild>
                    <a href="/" className="flex items-center space-x-2">
                      <span>Go to Dashboard</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Instructions */}
        {uploadState === 'idle' && (
          <Card className="my-4">
            <CardHeader>
              <CardTitle className="text-lg">How to Export from SmartRow</CardTitle>
              <CardDescription>
                Follow these steps to get your data from the SmartRow app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Open SmartRow App</p>
                    <p className="text-sm text-muted-foreground">
                      Open https://smartrow.fit/ in your browser and ensure you&apos;re logged in to your account.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Export Your Data</p>
                    <p className="text-sm text-muted-foreground">
                      Go to &quot;My Workouts&quot; → Click &quot;Export All&quot; then click &quot;Spreadsheet .csv file&quot; under &quot;List of your workouts&quot; to download the session list.
                      After the file was downloaded, click &quot;Export All&quot; again to get the detailed workout data from &quot;Workout files&quot;
                      (click &quot;.csv file&quot; again and wait a bit for the download to start).
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Upload Here</p>
                    <p className="text-sm text-muted-foreground">
                      Drag and drop the exported CSV file or ZIP archive above (csv first then zip)
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
