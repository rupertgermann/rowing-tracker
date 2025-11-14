import { Session, RawCsvRow } from '@/types/session';

/**
 * Validation error interface
 */
export interface ValidationError {
  row?: number;
  field?: string;
  value?: string;
  message: string;
}

/**
 * Required SmartRow CSV columns with their display names
 */
export const REQUIRED_COLUMNS = [
  { key: 'Time stamp (UTC)', display: 'Timestamp' },
  { key: 'Distance (m)', display: 'Distance' },
  { key: 'Time', display: 'Duration' },
  { key: 'Energy (kCal)', display: 'Energy' },
  { key: 'Stroke count (#)', display: 'Stroke Count' },
  { key: 'Average power (W)', display: 'Average Power' },
  { key: 'Maximum power (W)', display: 'Maximum Power' },
  { key: 'Average split (s)', display: 'Average Split' },
  { key: 'Minimum split (s)', display: 'Minimum Split' },
  { key: 'Average stroke rate (SPM)', display: 'Average Stroke Rate' },
  { key: 'Maximum stroke rate (SPM)', display: 'Maximum Stroke Rate' }
] as const;

/**
 * Validate CSV file format and content
 */
export function validateCsvFormat(headers: string[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check if file is empty
  if (!headers || headers.length === 0) {
    errors.push({
      message: 'CSV file appears to be empty or has no headers'
    });
    return errors;
  }

  // Check for required columns
  const headerSet = new Set(headers.map(h => h.trim()));
  const missingColumns = REQUIRED_COLUMNS.filter(col => !headerSet.has(col.key));
  
  if (missingColumns.length > 0) {
    errors.push({
      message: `Missing required columns: ${missingColumns.map(col => `${col.display} (${col.key})`).join(', ')}`
    });
  }

  // Check for common SmartRow column patterns
  const hasSmartRowPattern = headers.some(header => 
    header.includes('Time stamp (UTC)') || 
    header.includes('Distance (m)') ||
    header.includes('Average power (W)')
  );

  if (!hasSmartRowPattern) {
    errors.push({
      message: 'This does not appear to be a SmartRow CSV export. Expected columns like "Time stamp (UTC)", "Distance (m)", "Average power (W)"'
    });
  }

  return errors;
}

/**
 * Validate a single CSV row
 */
export function validateCsvRow(row: RawCsvRow, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate timestamp
  if (!row['Time stamp (UTC)'] || row['Time stamp (UTC)'].trim() === '') {
    errors.push({
      row: rowIndex,
      field: 'Time stamp (UTC)',
      value: row['Time stamp (UTC)'],
      message: 'Timestamp is required'
    });
  } else {
    // Check timestamp format
    const timestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{3})?$/;
    if (!timestampPattern.test(row['Time stamp (UTC)'].trim())) {
      errors.push({
        row: rowIndex,
        field: 'Time stamp (UTC)',
        value: row['Time stamp (UTC)'],
        message: 'Invalid timestamp format. Expected: YYYY-MM-DD HH:MM:SS.mmm or YYYY-MM-DD HH:MM:SS'
      });
    }
  }

  // Validate distance
  const distance = parseFloat(row['Distance (m)']?.replace(',', '.') || '0');
  if (isNaN(distance) || distance <= 0) {
    errors.push({
      row: rowIndex,
      field: 'Distance (m)',
      value: row['Distance (m)'],
      message: 'Distance must be a positive number'
    });
  } else if (distance > 50000) { // Reasonable upper limit
    errors.push({
      row: rowIndex,
      field: 'Distance (m)',
      value: row['Distance (m)'],
      message: 'Distance seems unusually high. Please verify the data.'
    });
  }

  // Validate duration
  const duration = parseFloat(row['Time']?.replace(',', '.') || '0');
  if (isNaN(duration) || duration <= 0) {
    errors.push({
      row: rowIndex,
      field: 'Time',
      value: row['Time'],
      message: 'Duration must be a positive number'
    });
  } else if (duration > 14400) { // 4 hours - reasonable upper limit
    errors.push({
      row: rowIndex,
      field: 'Time',
      value: row['Time'],
      message: 'Duration seems unusually high. Please verify the data.'
    });
  }

  // Validate energy
  const energy = parseFloat(row['Energy (kCal)']?.replace(',', '.') || '0');
  if (isNaN(energy) || energy < 0) {
    errors.push({
      row: rowIndex,
      field: 'Energy (kCal)',
      value: row['Energy (kCal)'],
      message: 'Energy must be a non-negative number'
    });
  }

  // Validate stroke count
  const strokeCount = parseFloat(row['Stroke count (#)']?.replace(',', '.') || '0');
  if (isNaN(strokeCount) || strokeCount < 0) {
    errors.push({
      row: rowIndex,
      field: 'Stroke count (#)',
      value: row['Stroke count (#)'],
      message: 'Stroke count must be a non-negative number'
    });
  }

  // Validate power values
  const avgPower = parseFloat(row['Average power (W)']?.replace(',', '.') || '0');
  const maxPower = parseFloat(row['Maximum power (W)']?.replace(',', '.') || '0');
  
  if (isNaN(avgPower) || avgPower < 0) {
    errors.push({
      row: rowIndex,
      field: 'Average power (W)',
      value: row['Average power (W)'],
      message: 'Average power must be a non-negative number'
    });
  }

  if (isNaN(maxPower) || maxPower < 0) {
    errors.push({
      row: rowIndex,
      field: 'Maximum power (W)',
      value: row['Maximum power (W)'],
      message: 'Maximum power must be a non-negative number'
    });
  }

  if (avgPower > 0 && maxPower > 0 && maxPower < avgPower) {
    errors.push({
      row: rowIndex,
      field: 'Maximum power (W)',
      value: row['Maximum power (W)'],
      message: 'Maximum power should be greater than or equal to average power'
    });
  }

  // Validate split times
  const avgSplit = parseFloat(row['Average split (s)']?.replace(',', '.') || '0');
  const minSplit = parseFloat(row['Minimum split (s)']?.replace(',', '.') || '0');
  
  if (isNaN(avgSplit) || avgSplit <= 0) {
    errors.push({
      row: rowIndex,
      field: 'Average split (s)',
      value: row['Average split (s)'],
      message: 'Average split must be a positive number'
    });
  }

  if (isNaN(minSplit) || minSplit <= 0) {
    errors.push({
      row: rowIndex,
      field: 'Minimum split (s)',
      value: row['Minimum split (s)'],
      message: 'Minimum split must be a positive number'
    });
  }

  if (avgSplit > 0 && minSplit > 0 && avgSplit < minSplit) {
    errors.push({
      row: rowIndex,
      field: 'Average split (s)',
      value: row['Average split (s)'],
      message: 'Average split should be greater than or equal to minimum split'
    });
  }

  // Validate stroke rates
  const avgStrokeRate = parseFloat(row['Average stroke rate (SPM)']?.replace(',', '.') || '0');
  const maxStrokeRate = parseFloat(row['Maximum stroke rate (SPM)']?.replace(',', '.') || '0');
  
  if (isNaN(avgStrokeRate) || avgStrokeRate <= 0) {
    errors.push({
      row: rowIndex,
      field: 'Average stroke rate (SPM)',
      value: row['Average stroke rate (SPM)'],
      message: 'Average stroke rate must be a positive number'
    });
  } else if (avgStrokeRate > 60) { // Very high but possible
    errors.push({
      row: rowIndex,
      field: 'Average stroke rate (SPM)',
      value: row['Average stroke rate (SPM)'],
      message: 'Average stroke rate seems unusually high. Please verify the data.'
    });
  }

  if (isNaN(maxStrokeRate) || maxStrokeRate <= 0) {
    errors.push({
      row: rowIndex,
      field: 'Maximum stroke rate (SPM)',
      value: row['Maximum stroke rate (SPM)'],
      message: 'Maximum stroke rate must be a positive number'
    });
  }

  if (avgStrokeRate > 0 && maxStrokeRate > 0 && maxStrokeRate < avgStrokeRate) {
    errors.push({
      row: rowIndex,
      field: 'Maximum stroke rate (SPM)',
      value: row['Maximum stroke rate (SPM)'],
      message: 'Maximum stroke rate should be greater than or equal to average stroke rate'
    });
  }

  return errors;
}

/**
 * Validate a complete session object
 */
export function validateSession(session: Session): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!session.id || session.id.trim() === '') {
    errors.push({
      message: 'Session ID is required'
    });
  }

  if (!(session.timestamp instanceof Date) || isNaN(session.timestamp.getTime())) {
    errors.push({
      message: 'Valid timestamp is required'
    });
  }

  if (typeof session.distance !== 'number' || session.distance <= 0) {
    errors.push({
      message: 'Distance must be a positive number'
    });
  }

  if (typeof session.duration !== 'number' || session.duration <= 0) {
    errors.push({
      message: 'Duration must be a positive number'
    });
  }

  if (typeof session.energy !== 'number' || session.energy < 0) {
    errors.push({
      message: 'Energy must be a non-negative number'
    });
  }

  if (typeof session.strokeCount !== 'number' || session.strokeCount < 0) {
    errors.push({
      message: 'Stroke count must be a non-negative number'
    });
  }

  if (typeof session.avgPower !== 'number' || session.avgPower < 0) {
    errors.push({
      message: 'Average power must be a non-negative number'
    });
  }

  if (typeof session.maxPower !== 'number' || session.maxPower < 0) {
    errors.push({
      message: 'Maximum power must be a non-negative number'
    });
  }

  if (session.avgPower > 0 && session.maxPower > 0 && session.maxPower < session.avgPower) {
    errors.push({
      message: 'Maximum power should be greater than or equal to average power'
    });
  }

  if (typeof session.avgSplit !== 'number' || session.avgSplit <= 0) {
    errors.push({
      message: 'Average split must be a positive number'
    });
  }

  if (typeof session.minSplit !== 'number' || session.minSplit <= 0) {
    errors.push({
      message: 'Minimum split must be a positive number'
    });
  }

  if (session.avgSplit > 0 && session.minSplit > 0 && session.avgSplit < session.minSplit) {
    errors.push({
      message: 'Average split should be greater than or equal to minimum split'
    });
  }

  return errors;
}

/**
 * Format validation errors for user display
 */
export function formatValidationErrors(errors: ValidationError[]): string[] {
  return errors.map(error => {
    if (error.row !== undefined) {
      const location = error.field ? `Row ${error.row}, Column "${error.field}"` : `Row ${error.row}`;
      const value = error.value ? ` (value: "${error.value}")` : '';
      return `${location}: ${error.message}${value}`;
    }
    return error.message;
  });
}

/**
 * Check if validation errors are critical (should prevent import)
 */
export function hasCriticalErrors(errors: ValidationError[]): boolean {
  return errors.some(error => 
    error.message.includes('Missing required columns') ||
    error.message.includes('does not appear to be a SmartRow CSV') ||
    error.message.includes('empty') ||
    error.message.includes('Required')
  );
}
