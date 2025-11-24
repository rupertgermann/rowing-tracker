import JSZip from 'jszip';
import { Session, StrokeData } from '@/types/session';
import { parseStrokeCsv } from './strokeParser';

export interface ZipImportResult {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    errors: string[];
    updatedSessions: number;
}

/**
 * Extract timestamp from filename
 * Expected format: YYYY-MM-DDTHHMMSS_distance.csv or similar
 * Example: 2025-08-15T124445_500m.csv
 */
function extractTimestampFromFilename(filename: string): Date | null {
    try {
        // Remove extension
        const name = filename.replace('.csv', '');

        // Extract date part (YYYY-MM-DDTHHMMSS)
        // The format seems to be YYYY-MM-DDTHHMMSS...
        const match = name.match(/^(\d{4}-\d{2}-\d{2}T\d{6})/);

        if (match) {
            const dateStr = match[1];
            // Format: YYYY-MM-DDTHHMMSS
            // We need to format it to be parseable by Date constructor or parse manually
            // 2025-08-15T124445 -> 2025-08-15T12:44:45
            const formattedDateStr = dateStr.replace(
                /(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})(\d{2})/,
                '$1T$2:$3:$4'
            );
            return new Date(formattedDateStr + 'Z'); // Assume UTC as per other files
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Find matching session for a given timestamp
 * Allows for a small time difference (e.g. 1 minute) as file timestamp might slightly differ from session start time
 */
function findMatchingSession(timestamp: Date, sessions: Session[]): Session | undefined {
    return sessions.find(session => {
        const timeDiff = Math.abs(session.timestamp.getTime() - timestamp.getTime());
        return timeDiff < 60 * 1000; // 1 minute tolerance
    });
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
                const timestamp = extractTimestampFromFilename(zipEntry.name);

                if (!timestamp) {
                    result.skippedFiles++;
                    // result.errors.push(`Could not extract timestamp from filename: ${zipEntry.name}`);
                    continue;
                }

                const session = findMatchingSession(timestamp, existingSessions);

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
