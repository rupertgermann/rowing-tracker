'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyChartProps {
  /** Unique ID for this chart */
  chartId: string;
  /** Chart title */
  title: string;
  /** Chart description */
  description?: string;
  /** Icon component */
  icon?: ReactNode;
  /** Border color */
  borderColor?: string;
  /** Background color for icon */
  iconBgColor?: string;
  /** Height of the chart */
  height?: number;
  /** Callback when chart enters viewport - should trigger data fetch */
  onVisible?: () => void;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Whether data has been loaded */
  hasData?: boolean;
  /** Header actions (buttons, etc) */
  headerActions?: ReactNode;
  /** Chart content to render when data is available */
  children: ReactNode;
  /** Ref callback for the card element */
  cardRef?: (el: HTMLDivElement | null) => void;
}

/**
 * LazyChart - A chart wrapper that lazy loads when scrolled into view
 *
 * Uses Intersection Observer to detect when the chart enters the viewport,
 * then triggers a callback to fetch the chart data.
 */
export function LazyChart({
  chartId,
  title,
  description,
  icon,
  borderColor = '#3b82f6',
  iconBgColor,
  height = 300,
  onVisible,
  isLoading = false,
  hasData = false,
  headerActions,
  children,
  cardRef,
}: LazyChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Set up Intersection Observer
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTriggered) {
            setIsVisible(true);
            setHasTriggered(true);
            onVisible?.();
          }
        });
      },
      {
        root: null, // viewport
        rootMargin: '100px', // Load slightly before entering viewport
        threshold: 0.1, // Trigger when 10% visible
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [hasTriggered, onVisible]);

  // Handle card ref
  const setRefs = (el: HTMLDivElement | null) => {
    (containerRef as any).current = el;
    cardRef?.(el);
  };

  return (
    <Card
      id={chartId}
      className="border-l-4"
      style={{ borderLeftColor: borderColor }}
      ref={setRefs}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <div
                className="p-2 rounded-md"
                style={{ backgroundColor: iconBgColor || `${borderColor}15` }}
              >
                <span style={{ color: borderColor }}>{icon}</span>
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      </CardHeader>
      <CardContent>
        {!isVisible || isLoading ? (
          // Loading skeleton
          <div className="space-y-3">
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="w-full" style={{ height: `${height}px` }} />
          </div>
        ) : hasData ? (
          // Render chart content
          children
        ) : (
          // No data state
          <div
            className="flex items-center justify-center text-muted-foreground"
            style={{ height: `${height}px` }}
          >
            <p>No data available for this chart.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Simple loading skeleton for charts
 */
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="w-full" style={{ height: `${height}px` }} />
    </div>
  );
}
