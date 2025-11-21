import { StrokeData } from '@/types/session';

export interface AdvancedStats {
  // Pacing
  fastest5StrokesPace: number; // seconds
  fastest5StrokesPower: number; // watts
  splitDrift: number; // percentage change first half vs second half
  powerDropoff: number; // percentage change first half vs second half

  // Variability (Consistency)
  stdDevSplit: number;
  stdDevPower: number;
  stdDevSPM: number;
  consistencyScore: number; // 0-100, derived from variability

  // Efficiency
  wattsPerHeartRate: number; // Average W / Average HR
  strokeEfficiency: number; // meters per stroke (avg)
}

export interface SegmentData {
  segmentNumber: number; // 1, 2, 3, 4...
  startDistance: number;
  endDistance: number;
  distance: number; // actual distance (might be < 500 for last segment)
  avgSplit: number; // seconds per 500m
  avgPower: number; // watts
  avgSPM: number; // strokes per minute
  avgStrokeLength: number; // meters per stroke
  strokeCount: number;
  duration: number; // seconds
}

export interface RollingAverages {
  strokeIndex: number;
  distance: number;
  power5: number; // 5-stroke rolling avg
  power10: number; // 10-stroke rolling avg
  split5: number; // 5-stroke rolling avg
  split10: number; // 10-stroke rolling avg
}

export interface PerformanceSummary {
  best500mSplit: number; // fastest 500m segment
  worst500mSplit: number; // slowest 500m segment
  peak10StrokePower: number; // highest 10-stroke rolling avg
  mostConsistent500m: number; // segment with lowest power variance
  totalWork: number; // total work in kJ
  avgStrokeLength: number; // overall average
}

// Calculate rolling averages using sliding window (O(n) complexity)
export const calculateRollingAverages = (data: StrokeData[], windowSize: number): { power: number; split: number }[] => {
  const result: { power: number; split: number }[] = [];
  if (data.length < windowSize) return result;

  // Initialize first window
  let powerSum = 0;
  let splitSum = 0;
  for (let i = 0; i < windowSize; i++) {
    powerSum += data[i].power;
    splitSum += data[i].split;
  }

  result.push({
    power: powerSum / windowSize,
    split: splitSum / windowSize
  });

  // Slide the window
  for (let i = windowSize; i < data.length; i++) {
    powerSum += data[i].power - data[i - windowSize].power;
    splitSum += data[i].split - data[i - windowSize].split;
    result.push({
      power: powerSum / windowSize,
      split: splitSum / windowSize
    });
  }

  return result;
};

// Group data into 500m segments
export const calculateSegments = (data: StrokeData[], segmentDistance: number = 500): SegmentData[] => {
  if (!data || data.length === 0) return [];

  const segments: SegmentData[] = [];
  const totalDistance = data[data.length - 1].distance;
  const numSegments = Math.ceil(totalDistance / segmentDistance);

  for (let i = 0; i < numSegments; i++) {
    const startDist = i * segmentDistance;
    const endDist = Math.min((i + 1) * segmentDistance, totalDistance);
    
    // Get strokes in this segment
    const segmentStrokes = data.filter(d => d.distance > startDist && d.distance <= endDist);
    
    if (segmentStrokes.length === 0) continue;

    const avgPower = segmentStrokes.reduce((sum, s) => sum + s.power, 0) / segmentStrokes.length;
    const avgSplit = segmentStrokes.reduce((sum, s) => sum + s.split, 0) / segmentStrokes.length;
    const avgSPM = segmentStrokes.reduce((sum, s) => sum + s.strokeRate, 0) / segmentStrokes.length;
    const avgStrokeLength = segmentStrokes.reduce((sum, s) => sum + (s.strokeLength || 0), 0) / segmentStrokes.length;
    const duration = segmentStrokes[segmentStrokes.length - 1].time - segmentStrokes[0].time;

    segments.push({
      segmentNumber: i + 1,
      startDistance: startDist,
      endDistance: endDist,
      distance: endDist - startDist,
      avgSplit,
      avgPower,
      avgSPM,
      avgStrokeLength,
      strokeCount: segmentStrokes.length,
      duration
    });
  }

  return segments;
};

// Calculate performance summary statistics
export const calculatePerformanceSummary = (data: StrokeData[], segments: SegmentData[]): PerformanceSummary => {
  if (!data || data.length === 0) {
    return {
      best500mSplit: 0,
      worst500mSplit: 0,
      peak10StrokePower: 0,
      mostConsistent500m: 0,
      totalWork: 0,
      avgStrokeLength: 0
    };
  }

  // Best/Worst 500m segments
  const fullSegments = segments.filter(s => s.distance >= 400); // Near-full segments only
  const bestSegment = fullSegments.reduce((best, current) => 
    current.avgSplit < best.avgSplit ? current : best, fullSegments[0] || { avgSplit: 0 }
  );
  const worstSegment = fullSegments.reduce((worst, current) => 
    current.avgSplit > worst.avgSplit ? current : worst, fullSegments[0] || { avgSplit: 0 }
  );

  // Peak 10-stroke power
  const rolling10 = calculateRollingAverages(data, 10);
  const peak10Power = rolling10.reduce((max, current) => 
    current.power > max ? current.power : max, 0
  );

  // Most consistent 500m (lowest power variance)
  const segmentVariances = fullSegments.map(segment => {
    const segmentStrokes = data.filter(d => d.distance > segment.startDistance && d.distance <= segment.endDistance);
    const powers = segmentStrokes.map(s => s.power);
    const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
    const variance = powers.reduce((sum, p) => sum + Math.pow(p - avgPower, 2), 0) / powers.length;
    return { segmentNumber: segment.segmentNumber, variance };
  });
  const mostConsistent = segmentVariances.reduce((best, current) => 
    current.variance < best.variance ? current : best, segmentVariances[0] || { segmentNumber: 0 }
  );

  // Total work and average stroke length
  const totalWork = data.reduce((sum, s) => sum + s.work, 0) / 1000; // Convert to kJ
  const avgStrokeLength = data.reduce((sum, s) => sum + (s.strokeLength || 0), 0) / data.length;

  return {
    best500mSplit: bestSegment.avgSplit,
    worst500mSplit: worstSegment.avgSplit,
    peak10StrokePower: peak10Power,
    mostConsistent500m: mostConsistent.segmentNumber,
    totalWork,
    avgStrokeLength
  };
};

export const calculateAdvancedStats = (data: StrokeData[]): AdvancedStats => {
  if (!data || data.length === 0) {
    return {
      fastest5StrokesPace: 0,
      fastest5StrokesPower: 0,
      splitDrift: 0,
      powerDropoff: 0,
      stdDevSplit: 0,
      stdDevPower: 0,
      stdDevSPM: 0,
      consistencyScore: 0,
      wattsPerHeartRate: 0,
      strokeEfficiency: 0,
    };
  }

  // Helper: Standard Deviation
  const calculateStdDev = (values: number[]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  };

  // Helper: Rolling Window Average
  const getRollingMax = (values: number[], windowSize: number) => {
    let max = 0;
    for (let i = 0; i <= values.length - windowSize; i++) {
      const sum = values.slice(i, i + windowSize).reduce((a, b) => a + b, 0);
      const avg = sum / windowSize;
      if (avg > max) max = avg; // For power (higher is better)
    }
    return max;
  };

  const getRollingMin = (values: number[], windowSize: number) => {
    let min = Infinity;
    for (let i = 0; i <= values.length - windowSize; i++) {
      const sum = values.slice(i, i + windowSize).reduce((a, b) => a + b, 0);
      const avg = sum / windowSize;
      if (avg < min) min = avg; // For split (lower is better)
    }
    return min === Infinity ? 0 : min;
  };

  // Pacing - Fastest 5 strokes (approx 10-15s burst)
  const splits = data.map(d => d.split).filter(s => s > 0);
  const powers = data.map(d => d.power);
  const spms = data.map(d => d.strokeRate);
  const hrs = data.map(d => d.heartRate || 0).filter(h => h > 0);

  const fastest5StrokesPace = getRollingMin(splits, 5);
  const fastest5StrokesPower = getRollingMax(powers, 5);

  // Drift / Dropoff (First Half vs Second Half)
  const midPoint = Math.floor(data.length / 2);
  const firstHalfPower = powers.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
  const secondHalfPower = powers.slice(midPoint).reduce((a, b) => a + b, 0) / (data.length - midPoint);
  const powerDropoff = ((firstHalfPower - secondHalfPower) / firstHalfPower) * 100;

  const firstHalfSplit = splits.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
  const secondHalfSplit = splits.slice(midPoint).reduce((a, b) => a + b, 0) / (data.length - midPoint);
  const splitDrift = ((secondHalfSplit - firstHalfSplit) / firstHalfSplit) * 100; // Positive means slower

  // Variability
  const stdDevSplit = calculateStdDev(splits);
  const stdDevPower = calculateStdDev(powers);
  const stdDevSPM = calculateStdDev(spms);

  // Consistency Score (Simple heuristic: lower std dev relative to mean is better)
  const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
  const cvPower = stdDevPower / avgPower; // Coefficient of variation
  // 100 - (CV * 100) clamped. E.g. CV of 0.1 (10%) -> 90 score.
  const consistencyScore = Math.max(0, Math.min(100, 100 - (cvPower * 200))); 

  // Efficiency
  const avgHR = hrs.length > 0 ? hrs.reduce((a, b) => a + b, 0) / hrs.length : 0;
  const wattsPerHeartRate = avgHR > 0 ? avgPower / avgHR : 0;

  // Stroke Efficiency (Avg Distance per Stroke)
  const strokeEfficiency = data.reduce((acc, curr) => acc + (curr.strokeLength || 0), 0) / data.length;

  return {
    fastest5StrokesPace,
    fastest5StrokesPower,
    splitDrift,
    powerDropoff,
    stdDevSplit,
    stdDevPower,
    stdDevSPM,
    consistencyScore,
    wattsPerHeartRate,
    strokeEfficiency
  };
};
