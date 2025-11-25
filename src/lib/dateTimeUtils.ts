import { SettingsService, UserPreferences } from './settings';

/**
 * Date/Time formatting utilities that respect user preferences
 */

type DateFormat = UserPreferences['dateFormat'];
type TimeFormat = UserPreferences['timeFormat'];

/**
 * Get the current user's date/time format preferences
 */
function getPreferences(): { dateFormat: DateFormat; timeFormat: TimeFormat; timeZone: string } {
  const settings = SettingsService.getInstance();
  const prefs = settings.getUserPreferences();
  return {
    dateFormat: prefs.dateFormat,
    timeFormat: prefs.timeFormat,
    timeZone: prefs.timeZone
  };
}

/**
 * Format a date according to user preferences
 * @param date - Date to format
 * @param options - Additional options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  options?: {
    includeTime?: boolean;
    includeWeekday?: boolean;
    shortMonth?: boolean;
  }
): string {
  const d = date instanceof Date ? date : new Date(date);
  const { dateFormat, timeFormat, timeZone } = getPreferences();
  
  const includeTime = options?.includeTime ?? false;
  const includeWeekday = options?.includeWeekday ?? false;
  const shortMonth = options?.shortMonth ?? true;

  // Build date parts based on format preference
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  
  // Format month name if using short format
  const monthName = d.toLocaleDateString('en-US', { 
    month: shortMonth ? 'short' : 'long',
    timeZone 
  });
  
  let dateStr: string;
  
  switch (dateFormat) {
    case 'DD/MM/YYYY':
      dateStr = shortMonth 
        ? `${day} ${monthName} ${year}`
        : `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      break;
    case 'YYYY-MM-DD':
      dateStr = shortMonth
        ? `${year} ${monthName} ${day}`
        : `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      break;
    case 'MM/DD/YYYY':
    default:
      dateStr = shortMonth
        ? `${monthName} ${day}, ${year}`
        : `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
      break;
  }

  // Add weekday if requested
  if (includeWeekday) {
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone });
    dateStr = `${weekday}, ${dateStr}`;
  }

  // Add time if requested
  if (includeTime) {
    const timeStr = formatTime(d);
    dateStr = `${dateStr}, ${timeStr}`;
  }

  return dateStr;
}

/**
 * Format time according to user preferences (12h or 24h)
 * @param date - Date to extract time from
 * @returns Formatted time string
 */
export function formatTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const { timeFormat, timeZone } = getPreferences();

  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat === '12h',
    timeZone
  };

  return d.toLocaleTimeString('en-US', options);
}

/**
 * Format a date for display in session lists (compact format with time)
 * @param date - Date to format
 * @returns Formatted date/time string
 */
export function formatSessionDate(date: Date | string): string {
  return formatDate(date, { includeTime: true, shortMonth: true });
}

/**
 * Format a date for display in session detail header (full format with weekday)
 * @param date - Date to format
 * @returns Formatted date/time string with weekday
 */
export function formatSessionDetailDate(date: Date | string): string {
  return formatDate(date, { includeTime: true, includeWeekday: true, shortMonth: false });
}

/**
 * Format a date for chart axis labels (short format, no time)
 * @param date - Date to format
 * @returns Short formatted date string
 */
export function formatChartDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const { dateFormat, timeZone } = getPreferences();
  
  const day = d.getDate();
  const monthName = d.toLocaleDateString('en-US', { month: 'short', timeZone });
  
  switch (dateFormat) {
    case 'DD/MM/YYYY':
      return `${day} ${monthName}`;
    case 'YYYY-MM-DD':
      return `${monthName} ${day}`;
    case 'MM/DD/YYYY':
    default:
      return `${monthName} ${day}`;
  }
}

/**
 * Format a date with time (for records, achievements, etc.)
 * @param date - Date to format
 * @returns Formatted date string with time
 */
export function formatDateOnly(date: Date | string): string {
  return formatDate(date, { includeTime: true, shortMonth: true });
}

/**
 * Format month and year (for period comparison labels)
 * @param date - Date to format
 * @param shortMonth - Use short month name (default: false)
 * @returns Formatted month/year string
 */
export function formatMonthYear(date: Date | string, shortMonth: boolean = false): string {
  const d = date instanceof Date ? date : new Date(date);
  const { dateFormat, timeZone } = getPreferences();
  
  const monthName = d.toLocaleDateString('en-US', { 
    month: shortMonth ? 'short' : 'long', 
    timeZone 
  });
  const year = d.getFullYear();
  
  switch (dateFormat) {
    case 'DD/MM/YYYY':
    case 'YYYY-MM-DD':
      return `${monthName} ${year}`;
    case 'MM/DD/YYYY':
    default:
      return `${monthName} ${year}`;
  }
}
