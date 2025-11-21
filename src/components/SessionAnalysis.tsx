'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StrokeData } from '@/types/session';
import { calculateAdvancedStats, calculateSegments, calculateRollingAverages, calculatePerformanceSummary } from '@/lib/analysisUtils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Assuming these exist or standard tabs
import { ComposedChart } from 'recharts';
import { useRowingStore } from '@/lib/store';

interface SessionAnalysisProps {
  data: StrokeData[];
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatSplit = (seconds: number) => {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-medium mb-2">
          Stroke {payload[0].payload.strokeIndex} ({formatDuration(payload[0].payload.time)})
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2" style={{ color: entry.color }}>
            <span className="font-semibold">
              {entry.name}:
            </span>
            <span>
              {entry.name.includes('Split') 
                ? formatSplit(entry.value)
                : entry.name === 'Distance' 
                  ? `${entry.value}m` 
                  : entry.name.includes('Length')
                    ? `${entry.value}m`
                    : Math.round(entry.value)}
              {entry.unit}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function SessionAnalysis({ data }: SessionAnalysisProps) {
  const { sessionAnalysisSettings, updateSessionAnalysisSettings } = useRowingStore();
  const activeTab = sessionAnalysisSettings?.activeTab ?? 'overview';
  const segmentSize = sessionAnalysisSettings?.segmentSize ?? 500;

  const handleTabChange = (value: string) => {
    if (value === activeTab) return;
    updateSessionAnalysisSettings({ activeTab: value as typeof activeTab });
  };

  const handleSegmentSizeChange = (size: 100 | 500) => {
    if (size === segmentSize) return;
    updateSessionAnalysisSettings({ segmentSize: size });
  };
  // Enrich data if strokeLength is missing (backward compatibility for previously uploaded sessions)
  const enrichedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Check if we need to calculate strokeLength
    const needsCalculation = typeof data[0].strokeLength === 'undefined';
    
    if (!needsCalculation) {
       return data;
    }

    console.log('Calculating stroke lengths on the fly for visualization...');
    // Sort by index to ensure correct delta calculation
    const sorted = [...data].sort((a, b) => a.strokeIndex - b.strokeIndex);
    
    return sorted.map((stroke, i) => {
      const prevDistance = i > 0 ? sorted[i-1].distance : 0;
      const length = stroke.distance - prevDistance;
      return {
        ...stroke,
        strokeLength: Math.max(0, parseFloat(length.toFixed(2)))
      };
    });
  }, [data]);

  const stats = useMemo(() => calculateAdvancedStats(enrichedData), [enrichedData]);
  const rolling5 = useMemo(() => calculateRollingAverages(enrichedData, 5), [enrichedData]);
  const rolling10 = useMemo(() => calculateRollingAverages(enrichedData, 10), [enrichedData]);
  
  // Calculate segments based on selected size
  const segments = useMemo(() => calculateSegments(enrichedData, segmentSize), [enrichedData, segmentSize]);
  
  const performanceSummary = useMemo(() => calculatePerformanceSummary(enrichedData, segments), [enrichedData, segments]);

  // Combine rolling data for charts
  const rollingData = useMemo(() => {
    const result = [];
    for (let i = 0; i < Math.min(rolling5.length, rolling10.length); i++) {
      const strokeIdx = i + 10; // Rolling averages start after the window
      result.push({
        strokeIndex: strokeIdx,
        distance: enrichedData[strokeIdx]?.distance || 0,
        power5: rolling5[i].power,
        power10: rolling10[i].power,
        split5: rolling5[i].split,
        split10: rolling10[i].split
      });
    }
    return result;
  }, [rolling5, rolling10, enrichedData]);

  // Prepare histogram data
  const distributions = useMemo(() => {
    const powerBuckets: Record<string, number> = {};
    const spmBuckets: Record<string, number> = {};
    
    enrichedData.forEach(d => {
      // Power (25W buckets)
      const pBucket = Math.floor(d.power / 25) * 25;
      const pLabel = `${pBucket}-${pBucket + 25}`;
      powerBuckets[pLabel] = (powerBuckets[pLabel] || 0) + 1;

      // SPM (1 SPM buckets)
      const sBucket = Math.round(d.strokeRate);
      spmBuckets[sBucket] = (spmBuckets[sBucket] || 0) + 1;
    });

    return {
      power: Object.entries(powerBuckets)
        .map(([range, count]) => ({ range, count, min: parseInt(range.split('-')[0]) }))
        .sort((a, b) => a.min - b.min),
      spm: Object.entries(spmBuckets)
        .map(([rate, count]) => ({ rate: parseInt(rate), count }))
        .sort((a, b) => a.rate - b.rate)
    };
  }, [enrichedData]);

  const formatTime = (seconds: number) => {
    if (seconds === 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  const formatSplit = (splitSeconds: number) => {
    if (splitSeconds === 0) return '--:--';
    const totalSeconds = Math.round(splitSeconds);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.round((splitSeconds % 1) * 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  };

  const formatWatts = (watts: number) => `${watts.toFixed(0)} W`;
  const formatSPM = (spm: number) => `${spm.toFixed(1)} spm`;
  const formatBPM = (bpm: number) => `${Math.round(bpm)} bpm`;
  const formatMeters = (meters: number) => `${meters.toFixed(1)} m`;
  const formatKilojoules = (kj: number) => `${kj.toFixed(1)} kJ`;

  return (
    <div className="space-y-8">
      {/* Performance Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Best 500m</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatSplit(performanceSummary.best500mSplit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Worst 500m</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatSplit(performanceSummary.worst500mSplit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Peak 10-Stroke Power</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatWatts(performanceSummary.peak10StrokePower)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Most Consistent 500m</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">Segment {performanceSummary.mostConsistent500m}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatKilojoules(performanceSummary.totalWork)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Avg Stroke Length</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatMeters(performanceSummary.avgStrokeLength)}</div>
          </CardContent>
        </Card>
      </div>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Analysis Modules
          </p>
          <p className="text-sm text-muted-foreground">
            Choose how you want to explore this session: summary metrics, visual performance trends, interval segments, or deep-dive analysis.
          </p>
        </div>
        <TabsList className="grid w-full grid-cols-4 gap-2 mb-8 rounded-2xl bg-secondary/50 p-2 shadow-sm border border-border/70 h-auto">
          <TabsTrigger
            value="overview"
            className="h-12 rounded-xl text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/80"
          >
            Overview & Stats
          </TabsTrigger>
          <TabsTrigger
            value="charts"
            className="h-12 rounded-xl text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/80"
          >
            Performance Graphs
          </TabsTrigger>
          <TabsTrigger
            value="segments"
            className="h-12 rounded-xl text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/80"
          >
            Segments
          </TabsTrigger>
          <TabsTrigger
            value="analysis"
            className="h-12 rounded-xl text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/80"
          >
            Deep Analysis
          </TabsTrigger>
        </TabsList>

        {/* TAB: OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">
          {/* Advanced Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Consistency Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(stats.consistencyScore)}/100</div>
                <p className="text-xs text-muted-foreground">Based on power variance</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fastest 5 Strokes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatSplit(stats.fastest5StrokesPace)}</div>
                <p className="text-xs text-muted-foreground">Avg Power: {Math.round(stats.fastest5StrokesPower)}W</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Efficiency Factor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                    {stats.wattsPerHeartRate > 0 ? stats.wattsPerHeartRate.toFixed(2) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">Watts per Heart Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fade / Drift</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.powerDropoff > 5 ? 'text-red-500' : 'text-green-500'}`}>
                    {stats.powerDropoff > 0 ? '-' : '+'}{Math.abs(Math.round(stats.powerDropoff))}%
                </div>
                <p className="text-xs text-muted-foreground">Power change 1st vs 2nd half</p>
              </CardContent>
            </Card>
          </div>

          {/* Primary Chart: Power & Rate */}
          <Card>
            <CardHeader>
              <CardTitle>Power & Stroke Rate</CardTitle>
              <CardDescription>Power output (Watts) and Stroke Rate (SPM) over the session</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={enrichedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="distance" 
                      label={{ value: 'Distance (m)', position: 'insideBottomRight', offset: -10 }} 
                      tickFormatter={(val) => `${val}m`}
                    />
                    <YAxis yAxisId="left" label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'SPM', angle: 90, position: 'insideRight' }} domain={[10, 50]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="power" 
                      name="Power" 
                      unit="W"
                      stroke="#2563eb" 
                      dot={false} 
                      strokeWidth={2}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="strokeRate" 
                      name="Stroke Rate" 
                      unit=" spm"
                      stroke="#dc2626" 
                      dot={false} 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: GRAPHS */}
        <TabsContent value="charts" className="space-y-8">
          {/* Pace Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Pace Analysis</CardTitle>
              <CardDescription>Actual vs Average Split (/500m)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={enrichedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="distance" 
                      tickFormatter={(val) => `${val}m`}
                    />
                    <YAxis 
                      domain={['dataMin - 5', 'dataMax + 5']} 
                      reversed={true} 
                      tickFormatter={(val) => formatDuration(val)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="split" 
                      name="Actual Split" 
                      stroke="#16a34a" 
                      dot={false} 
                      strokeWidth={1.5} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="avgSplit" 
                      name="Avg Split" 
                      stroke="#9333ea" 
                      strokeDasharray="5 5" 
                      dot={false} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Work per Stroke */}
          <Card>
            <CardHeader>
              <CardTitle>Work per Stroke</CardTitle>
              <CardDescription>Energy expenditure (Joules) per stroke</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={enrichedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="distance" tickFormatter={(val) => `${val}m`} />
                    <YAxis label={{ value: 'Work (J)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="work" 
                      name="Work" 
                      unit="J"
                      stroke="#ea580c" 
                      fill="#ea580c" 
                      fillOpacity={0.2} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Stroke Length */}
          <Card>
            <CardHeader>
              <CardTitle>Stroke Length Consistency</CardTitle>
              <CardDescription>Distance covered per stroke (meters)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={enrichedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="strokeIndex" label={{ value: 'Stroke #', position: 'insideBottomRight', offset: -10 }} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} label={{ value: 'Length (m)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="strokeLength" 
                      name="Stroke Length" 
                      unit="m"
                      stroke="#0891b2" 
                      dot={false} 
                      strokeWidth={2} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Heart Rate (if available) */}
          {enrichedData.some(d => d.heartRate) && (
            <Card>
              <CardHeader>
                <CardTitle>Heart Rate Response</CardTitle>
                <CardDescription>Heart Rate (BPM) over session</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={enrichedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="time" tickFormatter={formatDuration} label={{ value: 'Time', position: 'insideBottomRight', offset: -10 }} />
                      <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="heartRate" 
                        name="Heart Rate" 
                        unit=" bpm"
                        stroke="#be123c" 
                        dot={false} 
                        strokeWidth={2} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB: SEGMENTS */}
        <TabsContent value="segments" className="space-y-6">
          {/* Segment Size Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Segment Analysis</h3>
              <p className="text-sm text-muted-foreground">Analyze performance by distance segments</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSegmentSizeChange(100)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  segmentSize === 100
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                100m
              </button>
              <button
                onClick={() => handleSegmentSizeChange(500)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  segmentSize === 500
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                500m
              </button>
            </div>
          </div>

          {/* Segment Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>{segmentSize}m Segment Analysis</CardTitle>
              <CardDescription>Average power, split, and stroke rate for each {segmentSize}m segment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={segments} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="segmentNumber" 
                      label={{ value: 'Segment', position: 'insideBottomRight', offset: -10 }}
                      tickFormatter={(val) => `${val}`}
                    />
                    <YAxis yAxisId="left" label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Split (s/500m)', angle: 90, position: 'insideRight' }} />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-background border rounded p-2">
                              <p className="font-medium">Segment {data.segmentNumber}</p>
                              <p className="text-sm">Distance: {data.distance.toFixed(0)}m</p>
                              <p className="text-sm">Power: {Math.round(data.avgPower)}W</p>
                              <p className="text-sm">Split: {formatSplit(data.avgSplit)}</p>
                              <p className="text-sm">SPM: {data.avgSPM.toFixed(1)}</p>
                              <p className="text-sm">Strokes: {data.strokeCount}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="avgPower" name="Avg Power" fill="#2563eb" opacity={0.8} />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="avgSplit" 
                      name="Avg Split" 
                      stroke="#dc2626" 
                      strokeWidth={3}
                      dot={{ fill: '#dc2626', r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Rolling Averages */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Rolling Power Average</CardTitle>
                <CardDescription>5-stroke vs 10-stroke rolling average power</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rollingData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis 
                        dataKey="strokeIndex" 
                        label={{ value: 'Stroke #', position: 'insideBottomRight', offset: -10 }}
                      />
                      <YAxis label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border rounded p-2">
                                <p className="font-medium">Stroke {data.strokeIndex}</p>
                                <p className="text-sm">Distance: {data.distance.toFixed(0)}m</p>
                                <p className="text-sm">5-stroke avg: {Math.round(data.power5)}W</p>
                                <p className="text-sm">10-stroke avg: {Math.round(data.power10)}W</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="power5" 
                        name="5-Stroke Avg" 
                        stroke="#2563eb" 
                        dot={false} 
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="power10" 
                        name="10-Stroke Avg" 
                        stroke="#10b981" 
                        dot={false} 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rolling Split Average</CardTitle>
                <CardDescription>5-stroke vs 10-stroke rolling average split time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rollingData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis 
                        dataKey="strokeIndex" 
                        label={{ value: 'Stroke #', position: 'insideBottomRight', offset: -10 }}
                      />
                      <YAxis 
                        label={{ value: 'Split (s/500m)', angle: -90, position: 'insideLeft' }}
                        reversed={true}
                        tickFormatter={(val) => formatSplit(val)}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border rounded p-2">
                                <p className="font-medium">Stroke {data.strokeIndex}</p>
                                <p className="text-sm">Distance: {data.distance.toFixed(0)}m</p>
                                <p className="text-sm">5-stroke avg: {formatSplit(data.split5)}</p>
                                <p className="text-sm">10-stroke avg: {formatSplit(data.split10)}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="split5" 
                        name="5-Stroke Avg" 
                        stroke="#dc2626" 
                        dot={false} 
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="split10" 
                        name="10-Stroke Avg" 
                        stroke="#f59e0b" 
                        dot={false} 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Segment Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>{segmentSize}m Segment Details</CardTitle>
              <CardDescription>Detailed metrics for each {segmentSize}m segment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Segment</th>
                      <th className="text-left p-2">Distance</th>
                      <th className="text-left p-2">Split</th>
                      <th className="text-left p-2">Power</th>
                      <th className="text-left p-2">SPM</th>
                      <th className="text-left p-2">Stroke Length</th>
                      <th className="text-left p-2">Strokes</th>
                      <th className="text-left p-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.map((segment) => (
                      <tr key={segment.segmentNumber} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{segment.segmentNumber}</td>
                        <td className="p-2">{segment.distance.toFixed(0)}m</td>
                        <td className="p-2">{formatSplit(segment.avgSplit)}</td>
                        <td className="p-2">{Math.round(segment.avgPower)}W</td>
                        <td className="p-2">{segment.avgSPM.toFixed(1)}</td>
                        <td className="p-2">{segment.avgStrokeLength.toFixed(2)}m</td>
                        <td className="p-2">{segment.strokeCount}</td>
                        <td className="p-2">{formatTime(segment.duration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: ANALYSIS */}
        <TabsContent value="analysis" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Power Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Power Distribution</CardTitle>
                <CardDescription>Strokes per power zone</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributions.power} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="range" angle={-45} textAnchor="end" height={60} interval={0} fontSize={12} />
                      <YAxis allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                      <Bar dataKey="count" name="Strokes" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* SPM Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Rhythm Distribution</CardTitle>
                <CardDescription>Strokes per Stroke Rate (SPM)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributions.spm} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="rate" />
                      <YAxis allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                      <Bar dataKey="count" name="Strokes" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Technique Map: Rate vs Power */}
            <Card>
              <CardHeader>
                <CardTitle>Rate vs Power</CardTitle>
                <CardDescription>Do higher rates yield more power?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" dataKey="strokeRate" name="Rate" unit="spm" domain={['auto', 'auto']} />
                        <YAxis type="number" dataKey="power" name="Power" unit="W" domain={['auto', 'auto']} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter name="Rate vs Power" data={enrichedData} fill="#8b5cf6" fillOpacity={0.6} />
                     </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Rate vs Split Efficiency */}
            <Card>
               <CardHeader>
                 <CardTitle>Rate vs Split</CardTitle>
                 <CardDescription>Efficiency check: Faster rate should equal faster split</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="h-[300px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                         <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                         <XAxis type="number" dataKey="strokeRate" name="Rate" unit="spm" domain={['auto', 'auto']} />
                         <YAxis 
                           type="number" 
                           dataKey="split" 
                           name="Split" 
                           unit="s" 
                           domain={['auto', 'auto']} 
                           reversed={true}
                           tickFormatter={(val) => formatDuration(val)} 
                         />
                         <Tooltip 
                           cursor={{ strokeDasharray: '3 3' }} 
                           formatter={(value: any, name: any) => [
                             name === 'Split' ? formatDuration(value) : value,
                             name
                           ]}
                         />
                         <Scatter name="Rate vs Split" data={enrichedData} fill="#10b981" fillOpacity={0.6} />
                      </ScatterChart>
                   </ResponsiveContainer>
                 </div>
               </CardContent>
             </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
