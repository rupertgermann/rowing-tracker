'use client';

import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, HelpCircle } from 'lucide-react';
import { chartTheme } from '@/lib/chartUtils';
import { formatChartDate } from '@/lib/dateTimeUtils';
import { calculateAdvancedStats } from '@/lib/analysisUtils';
import { TimeRangeSelector, defaultTimeRangeOptions, type TimeRange } from '@/components/ui/time-range-selector';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Session {
  id: string;
  timestamp: Date;
  strokeData?: any[];
}

interface ConsistencyScoreChartProps {
  sessions: Session[];
  chartType?: 'line' | 'bar' | 'area';
  onExplainChart?: (chartId: string, chartTitle: string, chartDescription: string, dataContext: string, fullData: any[]) => void;
  headerActions?: React.ReactNode;
}

// Smoothing options
type SmoothingOption = 0 | 3 | 5 | 10;

const smoothingOptions: { value: SmoothingOption; label: string }[] = [
  { value: 0, label: 'None' },
  { value: 3, label: '3' },
  { value: 5, label: '5' },
  { value: 10, label: '10' },
];

// Calculate moving average for smoothing
const calculateMovingAverage = (data: { consistencyScore: number }[], windowSize: number): (number | null)[] => {
  if (windowSize === 0) return data.map(d => d.consistencyScore);
  
  return data.map((_, index) => {
    if (index < windowSize - 1) return null;
    
    const window = data.slice(index - windowSize + 1, index + 1);
    const sum = window.reduce((acc, d) => acc + d.consistencyScore, 0);
    return sum / windowSize;
  });
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label, smoothing }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={chartTheme.tooltip.contentStyle}>
        <p style={chartTheme.tooltip.labelStyle}>{label}</p>
        <p style={chartTheme.tooltip.itemStyle}>
          Score: {Math.round(data.consistencyScore)}/100
        </p>
        {smoothing > 0 && data.smoothedScore !== null && (
          <p style={chartTheme.tooltip.itemStyle}>
            {smoothing}-Session Avg: {Math.round(data.smoothedScore)}/100
          </p>
        )}
      </div>
    );
  }
  return null;
};

export const ConsistencyScoreChart = ({ 
  sessions, 
  chartType = 'line',
  onExplainChart,
  headerActions 
}: ConsistencyScoreChartProps) => {
  // Local state for this chart's time range and smoothing
  const [localTimeRange, setLocalTimeRange] = useState<TimeRange>('all');
  const [smoothing, setSmoothing] = useState<SmoothingOption>(0);

  // Filter sessions by local time range
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      if (localTimeRange === 'all') return true;

      const sessionDate = new Date(session.timestamp);
      const now = new Date();
      const daysAgo = defaultTimeRangeOptions.find(option => option.value === localTimeRange)?.days;

      if (!daysAgo) return true;

      const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      return sessionDate >= cutoffDate;
    });
  }, [sessions, localTimeRange]);

  // Prepare chart data with consistency scores
  const chartData = useMemo(() => {
    if (!filteredSessions.length) return [];

    // Sort sessions by date and calculate consistency scores
    const sortedSessions = [...filteredSessions]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .filter(session => session.strokeData && session.strokeData.length > 0)
      .map(session => {
        const stats = calculateAdvancedStats(session.strokeData!);
        return {
          date: formatChartDate(new Date(session.timestamp)),
          fullDate: session.timestamp,
          sessionId: session.id,
          consistencyScore: stats.consistencyScore,
        };
      });

    // Calculate smoothed values
    const smoothedValues = calculateMovingAverage(sortedSessions, smoothing);

    return sortedSessions.map((data, index) => ({
      ...data,
      smoothedScore: smoothedValues[index],
    }));
  }, [filteredSessions, smoothing]);

  // Calculate Y-axis domain
  const yDomain = useMemo(() => {
    if (!chartData.length) return [0, 100];

    const scores = chartData.map(d => d.consistencyScore);
    const smoothedScores = chartData
      .map(d => d.smoothedScore)
      .filter((s): s is number => s !== null);
    const allValues = [...scores, ...smoothedScores];

    const min = Math.max(0, Math.floor(Math.min(...allValues) - 5));
    const max = Math.min(100, Math.ceil(Math.max(...allValues) + 5));

    return [min, max];
  }, [chartData]);

  // Generate data context for AI explanation
  const getDataContext = () => {
    if (chartData.length === 0) return 'No data available for this time period.';
    
    const scores = chartData.map(d => d.consistencyScore);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const latest = scores[scores.length - 1];
    const earliest = scores[0];
    
    return `- Time period: ${localTimeRange === 'all' ? 'All time' : defaultTimeRangeOptions.find(o => o.value === localTimeRange)?.label}
- Data points: ${scores.length} sessions
- Range: ${Math.round(min)}/100 to ${Math.round(max)}/100
- Average: ${Math.round(avg)}/100
- Earliest value: ${Math.round(earliest)}/100
- Latest value: ${Math.round(latest)}/100
- Trend: ${latest > earliest ? 'Improving' : latest < earliest ? 'Declining' : 'Stable'}
- Smoothing: ${smoothing === 0 ? 'None' : `${smoothing}-session moving average`}`;
  };

  const handleExplain = () => {
    if (onExplainChart) {
      onExplainChart(
        `consistency-score-${localTimeRange}-${smoothing}`,
        'Consistency Score Over Time',
        'This chart shows my consistency score (0-100) over time. Higher scores indicate more consistent stroke power, rate, and technique within sessions.',
        getDataContext(),
        chartData
      );
    }
  };

  // Common chart elements
  const commonChartElements = (
    <>
      <CartesianGrid 
        strokeDasharray={chartTheme.grid.strokeDasharray} 
        stroke={chartTheme.grid.stroke} 
        opacity={chartTheme.grid.opacity} 
      />
      <XAxis
        dataKey="date"
        stroke={chartTheme.axis.strokeColor}
        tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
      />
      <YAxis
        stroke={chartTheme.axis.strokeColor}
        tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
        domain={yDomain}
        tickFormatter={(value) => `${Math.round(value)}`}
      />
      <Tooltip content={<CustomTooltip smoothing={smoothing} />} />
    </>
  );

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    const color = '#14b8a6'; // Teal-500

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {commonChartElements}
            <Bar
              dataKey={smoothing > 0 ? 'smoothedScore' : 'consistencyScore'}
              fill={color}
              radius={[4, 4, 0, 0]}
            />
            {smoothing > 0 && (
              <Bar
                dataKey="consistencyScore"
                fill={color}
                fillOpacity={0.3}
                radius={[4, 4, 0, 0]}
              />
            )}
          </BarChart>
        );
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {commonChartElements}
            <Area
              type="monotone"
              dataKey="consistencyScore"
              stroke={color}
              fill={color}
              fillOpacity={0.3}
              strokeWidth={2}
            />
            {smoothing > 0 && (
              <Line
                type="monotone"
                dataKey="smoothedScore"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            )}
          </AreaChart>
        );
      default: // line
        return (
          <LineChart {...commonProps}>
            {commonChartElements}
            <Line
              type="monotone"
              dataKey="consistencyScore"
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
            />
            {smoothing > 0 && (
              <Line
                type="monotone"
                dataKey="smoothedScore"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                name={`${smoothing}-Session Avg`}
              />
            )}
          </LineChart>
        );
    }
  };

  return (
    <Card className="border-l-4 border-l-teal-500">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-teal-500/10">
                <BarChart3 className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  Consistency Score Over Time
                </CardTitle>
                <CardDescription>
                  Track your stroke consistency progress (higher is better)
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {headerActions}
              {onExplainChart && (
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExplain}
                      >
                        <HelpCircle className="h-4 w-4 mr-1" />
                        Explain
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Ask AI to explain this chart</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
            {/* Time Range Selector */}
            <TimeRangeSelector
              value={localTimeRange}
              onChange={setLocalTimeRange}
              showLabel
              label="Period:"
              size="sm"
            />

            {/* Smoothing Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Smooth:</span>
              <div className="flex gap-1">
                {smoothingOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={smoothing === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSmoothing(option.value)}
                    className="text-xs px-2"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Legend when smoothing is enabled */}
          {smoothing > 0 && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-teal-500" />
                <span>Individual Sessions</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-orange-500" />
                <span>{smoothing}-Session Moving Average</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="w-full">
            <ResponsiveContainer width="100%" height={300}>
              {renderChart()}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <p>No consistency score data available.</p>
            <p className="text-sm">
              {filteredSessions.length === 0 
                ? 'Try selecting a different time range or upload more data.'
                : 'Upload stroke-by-stroke data for your sessions to see consistency scores.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
