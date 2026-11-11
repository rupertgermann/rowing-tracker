import JSZip from 'jszip';
import { INGESTION_LIMITS } from './ingestionLimits';
import { Session } from '@/types/session';
import { parseStrokeCsv } from './strokeParser';

export interface ZipImportResult {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    errors: string[];
    updatedSessions: number;
    sessionsToSave: Session[];  // Sessions that need to be saved to DB
}

export interface ZipProcessProgress {
    current: number;
    total: number;
    message: string;
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
    } catch {
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
        const sessionTime = session.timestamp instanceof Date ? session.timestamp.getTime() : new Date(session.timestamp).getTime();
        const timeDiff = Math.abs(sessionTime - timestamp.getTime());
        if (timeDiff < maxTolerance && timeDiff < bestDiff) {
            bestDiff = timeDiff;
            bestMatch = session;
        }
    }

    return bestMatch;
}

class ZipLimitError extends Error {}

// Count directory records before JSZip allocates its entry objects; ZIP64 is outside this import budget.
function checkZipDirectory(bytes: ArrayBuffer): void {
    const view = new DataView(bytes);
    let end = view.byteLength - 22;
    const earliest = Math.max(0, end - 65535);
    while (end >= earliest && view.getUint32(end, true) !== 0x06054b50) end--;
    if (end < earliest) throw new Error('Invalid ZIP directory');
    let offset = view.getUint32(end + 16, true);
    let count = 0;
    while (offset + 46 <= end && view.getUint32(offset, true) === 0x02014b50) {
        if (++count > INGESTION_LIMITS.zipEntries) throw new ZipLimitError('ZIP entry limit is 2000');
        offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    }
    if (offset !== end || count !== view.getUint16(end + 10, true)) throw new Error('Unsupported or invalid ZIP directory');
}

function readZipCsv(entry: JSZip.JSZipObject, budget: { expanded: number }): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let length = 0;
        let stopped = false;
        // JSZip 3.10 exposes this streaming reader but omits it from JSZipObject's typings.
        const stream = (entry as JSZip.JSZipObject & { internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array<ArrayBuffer>> }).internalStream('uint8array');
        stream.on('data', (chunk: Uint8Array<ArrayBuffer>) => {
            if (stopped) return;
            length += chunk.byteLength;
            budget.expanded += chunk.byteLength;
            if (length > INGESTION_LIMITS.csvBytes || budget.expanded > INGESTION_LIMITS.zipExpandedBytes) {
                stopped = true;
                stream.pause();
                reject(new ZipLimitError('ZIP expanded size limit exceeded (8 MiB per CSV, 64 MiB total)'));
                return;
            }
            chunks.push(chunk);
        });
        stream.on('error', reject);
        stream.on('end', () => { if (!stopped) resolve(new Blob(chunks, { type: 'text/csv' })); });
        stream.resume();
    });
}

/**
 * Process a ZIP file containing detailed workout CSVs
 * Returns the updated sessions for bulk saving (doesn't save to DB directly)
 */
export async function processZipFile(
    file: File,
    existingSessions: Session[],
    onProgress?: (progress: ZipProcessProgress) => void
): Promise<ZipImportResult> {
    const result: ZipImportResult = {
        totalFiles: 0,
        processedFiles: 0,
        skippedFiles: 0,
        errors: [],
        updatedSessions: 0,
        sessionsToSave: []
    };

    try {
        if (file.size > INGESTION_LIMITS.zipBytes) throw new ZipLimitError('ZIP compressed size limit is 32 MiB');
        const bytes = await file.arrayBuffer();
        if (bytes.byteLength > INGESTION_LIMITS.zipBytes) throw new ZipLimitError('ZIP compressed size limit is 32 MiB');
        checkZipDirectory(bytes);
        const loadedZip = await new JSZip().loadAsync(bytes);
        const budget = { expanded: 0 };

        const files = Object.values(loadedZip.files).filter(f => !f.dir && f.name.endsWith('.csv'));
        result.totalFiles = files.length;

        // Track which sessions we've already updated (by id) to avoid duplicates
        const updatedSessionsMap = new Map<string, Session>();

        for (let i = 0; i < files.length; i++) {
            const zipEntry = files[i];

            // Report progress
            onProgress?.({
                current: i + 1,
                total: files.length,
                message: `Parsing file ${i + 1} of ${files.length}...`
            });
            try {
                const fileInfo = extractInfoFromFilename(zipEntry.name);

                if (!fileInfo) {
                    result.skippedFiles++;
                    continue;
                }
                const session = findMatchingSession(fileInfo.timestamp, existingSessions, fileInfo.distance);

                if (!session) {
                    result.skippedFiles++;
                    continue;
                }

                const content = await readZipCsv(zipEntry, budget);
                const csvFile = new File([content], zipEntry.name, { type: 'text/csv' });

                const parseResult = await parseStrokeCsv(csvFile);

                if (parseResult.data.length > 0) {
                    const updatedSession = { ...session, strokeData: parseResult.data };
                    updatedSessionsMap.set(session.id, updatedSession);
                    result.updatedSessions++;
                    result.processedFiles++;
                } else {
                    result.skippedFiles++;
                    if (parseResult.error) {
                        result.errors.push(`Error parsing ${zipEntry.name}: ${parseResult.error}`);
                    }
                }

            } catch (err) {
                if (err instanceof ZipLimitError) throw err;
                result.skippedFiles++;
                result.errors.push(`Error processing ${zipEntry.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }

        // Collect all updated sessions for bulk saving
        result.sessionsToSave = Array.from(updatedSessionsMap.values());

    } catch (err) {
        result.errors.push(`Failed to process ZIP file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return result;
}
