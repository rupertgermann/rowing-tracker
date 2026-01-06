import Papa from 'papaparse';
import { StrokeData } from '@/types/session';

/**
 * Detect delimiter from first line of CSV
 * Returns ';' or ',' depending on which one appears more
 */
function detectDelimiter(firstLine: string): string {
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  console.log(`Stroke CSV delimiter detection: semicolons=${semicolonCount}, commas=${commaCount}`);
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Parse European decimal format (comma to dot)
 */
function parseEuropeanNumber(value: string | undefined): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.trim().replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse SmartRow Detailed Stroke CSV
 */
export function parseStrokeCsv(file: File): Promise<{ data: StrokeData[]; error?: string }> {
  return new Promise((resolve) => {
    // Auto-detect delimiter
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const firstLine = text.split('\n')[0];
      const delimiter = detectDelimiter(firstLine);

      Papa.parse(file, {
        delimiter: delimiter,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const headers = results.meta.fields || [];
            // Validate headers for Detailed CSV
            // Expected: Stroke (#);Second (#);Timestamp (UTC);Distance (m);Work (J);Actual power (W)...
            const required = ['Stroke (#)', 'Second (#)', 'Actual power (W)'];
            const missing = required.filter(h => !headers.includes(h));

            if (missing.length > 0) {
              console.error('Stroke CSV validation failed. Missing:', missing);
              console.error('Available headers:', headers);
              resolve({
                data: [],
                error: `Missing columns: ${missing.join(', ')}. Is this a detailed stroke CSV?`
              });
              return;
            }

            const parsedData: StrokeData[] = (results.data as Record<string, string | undefined>[])
              .map((row) => {
                if (!row['Stroke (#)']) return null;

                const distance = parseEuropeanNumber(row['Distance (m)']);
                // Calculate stroke length based on previous cumulative distance
                // For first stroke, it's just the distance

                return {
                  strokeIndex: parseInt(row['Stroke (#)'] || '0'),
                  time: parseInt(row['Second (#)'] || '0'),
                  timestamp: row['Timestamp (UTC)'],
                  distance: distance,
                  work: parseEuropeanNumber(row['Work (J)']),
                  power: parseEuropeanNumber(row['Actual power (W)']),
                  avgPower: parseEuropeanNumber(row['Average power (W)']),
                  split: parseEuropeanNumber(row['Actual split (s)']),
                  avgSplit: parseEuropeanNumber(row['Average split (s)']),
                  strokeRate: parseEuropeanNumber(row['Stroke rate (SPM)']),
                  heartRate: row['Heart rate (bpm)'] ? parseEuropeanNumber(row['Heart rate (bpm)']) : null,
                  // strokeLength will be calculated in a second pass to ensure accuracy with filtered data
                };
              })
              .filter((item): item is StrokeData => item !== null);

            // Calculate stroke lengths
            // Sort by index just in case
            parsedData.sort((a, b) => a.strokeIndex - b.strokeIndex);

            const enrichedData = parsedData.map((stroke, i) => {
              const prevDistance = i > 0 ? parsedData[i-1].distance : 0;
              const length = stroke.distance - prevDistance;
              return {
                ...stroke,
                strokeLength: parseFloat(length.toFixed(2))
              };
            });

            resolve({ data: enrichedData });
          } catch {
            resolve({ data: [], error: 'Failed to parse stroke data.' });
          }
        },
        error: (err) => {
          resolve({ data: [], error: err.message });
        }
      });
    };

    reader.onerror = () => {
      resolve({ data: [], error: 'Failed to read file' });
    };

    reader.readAsText(file);
  });
}
