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
