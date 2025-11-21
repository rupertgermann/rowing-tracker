import Papa from 'papaparse';

export interface StrokeData {
  strokeIndex: number;
  time: number; // Second (#)
  timestamp: string;
  distance: number; // Cumulative distance
  work: number;
  power: number; // Actual power
  avgPower: number;
  split: number; // Actual split (s) - likely per 500m
  avgSplit: number;
  strokeRate: number;
  heartRate: number | null;
}

/**
 * Parse European decimal format (comma to dot)
 */
function parseEuropeanNumber(value: string): number {
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
    Papa.parse(file, {
      delimiter: ';',
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
            resolve({ 
              data: [], 
              error: `Missing columns: ${missing.join(', ')}. Is this a detailed stroke CSV?` 
            });
            return;
          }

          const parsedData: StrokeData[] = results.data
            .map((row: any) => {
              if (!row['Stroke (#)']) return null;

              return {
                strokeIndex: parseInt(row['Stroke (#)']),
                time: parseInt(row['Second (#)']),
                timestamp: row['Timestamp (UTC)'],
                distance: parseEuropeanNumber(row['Distance (m)']),
                work: parseEuropeanNumber(row['Work (J)']),
                power: parseEuropeanNumber(row['Actual power (W)']),
                avgPower: parseEuropeanNumber(row['Average power (W)']),
                split: parseEuropeanNumber(row['Actual split (s)']),
                avgSplit: parseEuropeanNumber(row['Average split (s)']),
                strokeRate: parseEuropeanNumber(row['Stroke rate (SPM)']),
                heartRate: row['Heart rate (bpm)'] ? parseEuropeanNumber(row['Heart rate (bpm)']) : null,
              };
            })
            .filter((item): item is StrokeData => item !== null);

          resolve({ data: parsedData });
        } catch (e) {
          resolve({ data: [], error: 'Failed to parse stroke data.' });
        }
      },
      error: (err) => {
        resolve({ data: [], error: err.message });
      }
    });
  });
}
