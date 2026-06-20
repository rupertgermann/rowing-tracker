'use client';

import React, { useState, useMemo } from 'react';
import { useRowingStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowDown, ArrowUp, Calendar, TrendingUp, Zap, Timer } from 'lucide-react';
import { formatMonthYear } from '@/lib/dateTimeUtils';

interface MonthlyStats {
  distance: number;
  avgPower: number;
  avgPace: number; // in seconds per 500m
  count: number;
}

export function PeriodComparisonStats() {
  const sessions = useRowingStore((state) => state.sessions);
  const { dashboardSettings, updateDashboardSettings } = useRowingStore();

  // Get unique months from sessions
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    sessions.forEach(s => {
      const d = new Date(s.timestamp);
      // Format as YYYY-MM for sorting/keys
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(months).sort().reverse(); // Newest first
  }, [sessions]);

  // Use stored value or fallback to default if not set
  const { periodA: storedPeriodA, periodB: storedPeriodB } = dashboardSettings.periodStats;
  
  const periodA = storedPeriodA || availableMonths[0] || '';
  const periodB = storedPeriodB || availableMonths[1] || '';
  
  const setPeriodA = (p: string) => updateDashboardSettings({ periodA: p });
  const setPeriodB = (p: string) => updateDashboardSettings({ periodB: p });

  // Helper to format month label
  const formatMonthLabel = (yyyymm: string) => {
    if (!yyyymm) return '';
    const [year, month] = yyyymm.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1);
    return formatMonthYear(d);
  };

  // Calculate stats for a given month
  const getStatsForMonth = (monthKey: string): MonthlyStats => {
    if (!monthKey) return { distance: 0, avgPower: 0, avgPace: 0, count: 0 };

    const [year, month] = monthKey.split('-').map(Number);
    const monthSessions = sessions.filter(s => {
      const d = new Date(s.timestamp);
      return d.getFullYear() === year && d.getMonth() === month - 1;
    });

    if (monthSessions.length === 0) return { distance: 0, avgPower: 0, avgPace: 0, count: 0 };

    const totalDist = monthSessions.reduce((sum, s) => sum + s.distance, 0);
    const totalDur = monthSessions.reduce((sum, s) => sum + s.duration, 0);
    
    // Weighted averages
    const weightedPower = monthSessions.reduce((sum, s) => sum + (s.avgPower * s.duration), 0);
    const avgPower = totalDur > 0 ? weightedPower / totalDur : 0;

    // Pace calculation
    const avgPace = totalDist > 0 ? totalDur / (totalDist / 500) : 0;

    return {
      distance: totalDist,
      avgPower,
      avgPace,
      count: monthSessions.length
    };
  };

  const statsA = useMemo(() => getStatsForMonth(periodA), [sessions, periodA]);
  const statsB = useMemo(() => getStatsForMonth(periodB), [sessions, periodB]);

  const renderComparisonCard = (
    title: string, 
    valueA: number, 
    valueB: number, 
    format: (v: number) => string,
    unit: string,
    icon: React.ComponentType<{ className?: string }>,
    inverse: boolean = false // for pace, lower is better (so negative change is green)
  ) => {
    const diff = valueA - valueB;
    const percentChange = valueB !== 0 ? (diff / valueB) * 100 : 0;
    
    // Determine color based on change
    // Usually positive change is green, negative is red.
    // For inverse metrics (like pace/split time), negative change (faster) is green.
    const isPositiveGood = !inverse;
    let isGood = isPositiveGood ? diff >= 0 : diff <= 0;
    
    // If values are equal
    if (Math.abs(diff) < 0.01) isGood = true; // Neutral

    const colorClass = isGood ? 'text-emerald-500' : 'text-rose-500';
    const TrendIcon = isGood ? (isPositiveGood ? ArrowUp : ArrowDown) : (isPositiveGood ? ArrowDown : ArrowUp);
    const MetricIcon = icon;
    
    // For 0% change or no previous data
    const isNeutral = valueB === 0 || Math.abs(percentChange) < 0.1;
    
    return (
      <Card className="bg-card/50 border-muted/50 shadow-sm border border-input">
        <CardContent className="px-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <MetricIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
            </div>
            {!isNeutral && (
              <div className={`flex items-center text-xs font-medium ${colorClass} bg-background/50 px-1.5 py-0.5 rounded`}>
                 <TrendIcon className="h-3 w-3 mr-1" />
                 {Math.abs(percentChange).toFixed(0)}%
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-foreground">
              {format(valueA)}<span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <span className="opacity-70">vs prev:</span>
            <span className="font-medium">{format(valueB)} {unit}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (availableMonths.length === 0) return null;

  return (
    <div className="w-full p-1 rounded-xl border bg-card/30 mb-6 transition-all hover:border-primary/30 hover:shadow-sm">
      <div className="px-3 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/50 mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-base">Monthly Comparison</h3>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
           <select 
            value={periodA} 
            onChange={(e) => setPeriodA(e.target.value)}
            className="bg-background border border-input rounded-md h-8 px-2 py-0 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
          <span className="text-muted-foreground text-xs">vs</span>
          <select 
            value={periodB} 
            onChange={(e) => setPeriodB(e.target.value)}
            className="bg-background border border-input rounded-md h-8 px-2 py-0 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select month...</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-3 pb-3">
        {renderComparisonCard(
          "Total Distance", 
          statsA.distance, 
          statsB.distance, 
          (v) => Math.round(v).toLocaleString(), 
          "m",
          TrendingUp
        )}
        {renderComparisonCard(
          "Avg Power", 
          statsA.avgPower, 
          statsB.avgPower, 
          (v) => Math.round(v).toString(), 
          "W",
          Zap
        )}
        {renderComparisonCard(
          "Avg Split", 
          statsA.avgPace, 
          statsB.avgPace, 
          (v) => {
            const mins = Math.floor(v / 60);
            const secs = Math.floor(v % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
          }, 
          "/500m",
          Timer,
          true // inverse (lower is better)
        )}
      </div>
    </div>
  );
}
