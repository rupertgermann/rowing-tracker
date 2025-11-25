'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Unified time range type used across the app
export type TimeRange = '7days' | '30days' | '90days' | 'all';

export interface TimeRangeOption {
  value: TimeRange;
  label: string;
  shortLabel?: string;
  days?: number;
}

// Default options - can be overridden
export const defaultTimeRangeOptions: TimeRangeOption[] = [
  { value: '7days', label: '7 Days', shortLabel: '7D', days: 7 },
  { value: '30days', label: '30 Days', shortLabel: '30D', days: 30 },
  { value: '90days', label: '90 Days', shortLabel: '90D', days: 90 },
  { value: 'all', label: 'All Time', shortLabel: 'All' }
];

// Alternative labels for different contexts
export const lastPrefixedOptions: TimeRangeOption[] = [
  { value: 'all', label: 'All Time', shortLabel: 'All' },
  { value: '7days', label: 'Last 7 Days', shortLabel: '7D', days: 7 },
  { value: '30days', label: 'Last 30 Days', shortLabel: '30D', days: 30 },
  { value: '90days', label: 'Last 90 Days', shortLabel: '90D', days: 90 }
];

export interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  options?: TimeRangeOption[];
  size?: 'sm' | 'default';
  variant?: 'default' | 'compact';
  className?: string;
  label?: string;
  showLabel?: boolean;
}

/**
 * Unified Time Range Selector component
 * 
 * Used across Dashboard, Analytics, and Sessions pages for consistent UX.
 * 
 * @example
 * // Basic usage
 * <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
 * 
 * @example
 * // With label
 * <TimeRangeSelector 
 *   value={timeRange} 
 *   onChange={setTimeRange}
 *   showLabel
 *   label="Time Range:"
 * />
 * 
 * @example
 * // Compact variant for tight spaces
 * <TimeRangeSelector 
 *   value={timeRange} 
 *   onChange={setTimeRange}
 *   variant="compact"
 * />
 */
export function TimeRangeSelector({
  value,
  onChange,
  options = defaultTimeRangeOptions,
  size = 'sm',
  variant = 'default',
  className,
  label = 'Time Range:',
  showLabel = false,
}: TimeRangeSelectorProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <span className="text-sm text-muted-foreground mr-1">{label}</span>
      )}
      <div className="flex gap-1">
        {options.map((option) => (
          <Button
            key={option.value}
            variant={value === option.value ? 'default' : 'outline'}
            size={size}
            onClick={() => onChange(option.value)}
            className={cn(
              'transition-all duration-200 focus:ring-2 focus:ring-primary focus:ring-offset-2',
              variant === 'compact' ? 'text-xs px-2' : 'text-xs'
            )}
            aria-label={`Filter to ${option.label}`}
            aria-pressed={value === option.value}
          >
            {variant === 'compact' ? (option.shortLabel || option.label) : option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Helper function to filter sessions by time range
 */
export function filterByTimeRange<T extends { timestamp: Date | string }>(
  items: T[],
  timeRange: TimeRange
): T[] {
  if (timeRange === 'all') return items;

  const now = new Date();
  const daysMap: Record<TimeRange, number> = {
    '7days': 7,
    '30days': 30,
    '90days': 90,
    'all': 0
  };

  const days = daysMap[timeRange];
  const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return items.filter(item => {
    const itemDate = item.timestamp instanceof Date 
      ? item.timestamp 
      : new Date(item.timestamp);
    return itemDate >= cutoffDate;
  });
}

/**
 * Get the number of days for a time range
 */
export function getTimeRangeDays(timeRange: TimeRange): number | undefined {
  const option = defaultTimeRangeOptions.find(o => o.value === timeRange);
  return option?.days;
}
