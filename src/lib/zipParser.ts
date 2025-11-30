import JSZip from 'jszip';
import { Session } from '@/types/session';
import { parseStrokeCsv } from './strokeParser';

export interface ZipImportResult {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    errors: string[];
    updatedSessions: number;
}

interface FilenameInfo {
    timestamp: Date;
    distance: number | null;
}

/**
 * Extract timestamp and distance from filename
 * Expected format: YYYY-MM-DDTHHMMSS_distance.csv or similar
 * Example: 2025-08-15T124445_500m.csv
 */
function extractInfoFromFilename(filename: string): FilenameInfo | null {
    try {
        // Remove path prefix if present (for files inside folders in ZIP)
        const baseName = filename.split('/').pop() || filename;
        // Remove extension
        const name = baseName.replace('.csv', '');

        // Extract date part (YYYY-MM-DDTHHMMSS)
        const match = name.match(/^(\d{4}-\d{2}-\d{2}T\d{6})/);

        if (match) {
            const dateStr = match[1];
            // Format: YYYY-MM-DDTHHMMSS -> YYYY-MM-DDTHH:MM:SS
            const formattedDateStr = dateStr.replace(
                /(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})(\d{2})/,
                '$1T$2:$3:$4'
            );
            const timestamp = new Date(formattedDateStr + 'Z'); // Assume UTC
            
            // Extract distance from filename (e.g., _500m, _1000m, _100m)
            const distanceMatch = name.match(/_(\d+)m$/);
            const distance = distanceMatch ? parseInt(distanceMatch[1]) : null;
            
            return { timestamp, distance };
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Find matching session for a given timestamp and optional distance
 * Uses closest-match algorithm to handle sessions that are close together in time.
 * 
 * When distance is provided, it MUST match exactly to avoid assigning
 * stroke data to the wrong session (e.g., a 100m warmup vs 1000m main workout)
 */
function findMatchingSession(timestamp: Date, sessions: Session[], distance: number | null): Session | undefined {
    // Filter by distance first if provided
    const candidateSessions = distance !== null 
        ? sessions.filter(s => s.distance === distance)
        : sessions;
    
    // Find the CLOSEST match within 5 minute tolerance
    const maxTolerance = 5 * 60 * 1000; // 5 minutes
    
    let bestMatch: Session | undefined;
    let bestDiff = Infinity;
    
    for (const session of candidateSessions) {
        const timeDiff = Math.abs(session.timestamp.getTime() - timestamp.getTime());
        if (timeDiff < maxTolerance && timeDiff < bestDiff) {
            bestDiff = timeDiff;
            bestMatch = session;
        }
    }
    
    return bestMatch;
}

/**
 * Process a ZIP file containing detailed workout CSVs
 */
export async function processZipFile(
    file: File,
    existingSessions: Session[],
    updateSession: (session: Session) => void
): Promise<ZipImportResult> {
    const result: ZipImportResult = {
        totalFiles: 0,
        processedFiles: 0,
        skippedFiles: 0,
        errors: [],
        updatedSessions: 0
    };

    try {
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);

        const files = Object.values(loadedZip.files).filter(f => !f.dir && f.name.endsWith('.csv'));
        result.totalFiles = files.length;

        for (const zipEntry of files) {
            try {
                const fileInfo = extractInfoFromFilename(zipEntry.name);

                if (!fileInfo) {
                    result.skippedFiles++;
                    continue;
                }
                const session = findMatchingSession(fileInfo.timestamp, existingSessions, fileInfo.distance);

                if (!session) {
                    result.skippedFiles++;
                    // result.errors.push(`No matching session found for file: ${zipEntry.name}`);
                    continue;
                }

                // Check if session already has stroke data? 
                // Maybe we want to overwrite it or skip. For now, let's overwrite/update.

                const content = await zipEntry.async('blob');
                // Create a File object from Blob to reuse parseStrokeCsv
                const csvFile = new File([content], zipEntry.name, { type: 'text/csv' });

                const parseResult = await parseStrokeCsv(csvFile);

                if (parseResult.data.length > 0) {
                    const updatedSession = { ...session, strokeData: parseResult.data };
                    updateSession(updatedSession);
                    result.updatedSessions++;
                    result.processedFiles++;
                } else {
                    result.skippedFiles++;
                    if (parseResult.error) {
                        result.errors.push(`Error parsing ${zipEntry.name}: ${parseResult.error}`);
                    }
                }

            } catch (err) {
                result.skippedFiles++;
                result.errors.push(`Error processing ${zipEntry.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }

    } catch (err) {
        result.errors.push(`Failed to process ZIP file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return result;
}
