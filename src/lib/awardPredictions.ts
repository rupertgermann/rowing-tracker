import { Session } from '@/types/session';
import { AWARDS } from './awards';
import type { AIAwardCriteria } from './rowingSessionProjections';

// Aligned with AIAwardSuggestion format for consistency
export interface AwardPrediction {
  awardId: string;
  criteria: AIAwardCriteria; // Same format as AI suggestions
  currentProgress: number; // 0-100 percentage
  targetValue: number;
  currentValue: number;
  unit: string;
  targetDate: Date | null; // Aligned with AIAwardSuggestion.targetDate
  daysRemaining: number | null;
  isAchievable: boolean; // false if no progress trend or impossible
}

interface SessionStats {
  totalSessions: number;
  totalDistance: number;
  totalDuration: number;
  avgSessionsPerWeek: number;
  avgDistancePerSession: number;
  avgDurationPerSession: number;
  avgPower: number;
  bestPower: number;
  bestStreak: number;
  currentStreak: number;
  daysSinceFirstSession: number;
}

function calculateStats(sessions: Session[]): SessionStats {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalDistance: 0,
      totalDuration: 0,
      avgSessionsPerWeek: 0,
      avgDistancePerSession: 0,
      avgDurationPerSession: 0,
      avgPower: 0,
      bestPower: 0,
      bestStreak: 0,
      currentStreak: 0,
      daysSinceFirstSession: 0
    };
  }

  const sorted = [...sessions].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const totalDistance = sessions.reduce((acc, s) => acc + (s.distance || 0), 0);
  const totalDuration = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const avgPower = sessions.reduce((acc, s) => acc + (s.avgPower || 0), 0) / sessions.length;
  
  // Best power from qualifying sessions only (>5 min) to match award conditions
  const qualifyingSessions = sessions.filter(s => s.duration > 300);
  const bestPower = qualifyingSessions.length > 0 
    ? Math.max(...qualifyingSessions.map(s => s.avgPower || 0))
    : 0;

  const firstDate = new Date(sorted[0].timestamp);
  const lastDate = new Date(sorted[sorted.length - 1].timestamp);
  const daysSinceFirstSession = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
  const weeksSinceFirst = Math.max(1, daysSinceFirstSession / 7);

  // Calculate streaks
  let bestStreak = 0;
  let currentStreak = 0;
  const sessionDates = new Set(sorted.map(s => 
    new Date(s.timestamp).toISOString().split('T')[0]
  ));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check current streak from today backwards
  const checkDate = new Date(today);
  while (sessionDates.has(checkDate.toISOString().split('T')[0])) {
    currentStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  // Find best streak
  let streak = 0;
  const allDates = Array.from(sessionDates).sort();
  for (let i = 0; i < allDates.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const prev = new Date(allDates[i - 1]);
      const curr = new Date(allDates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak++;
      } else {
        streak = 1;
      }
    }
    bestStreak = Math.max(bestStreak, streak);
  }

  return {
    totalSessions: sessions.length,
    totalDistance,
    totalDuration,
    avgSessionsPerWeek: sessions.length / weeksSinceFirst,
    avgDistancePerSession: totalDistance / sessions.length,
    avgDurationPerSession: totalDuration / sessions.length,
    avgPower,
    bestPower,
    bestStreak,
    currentStreak,
    daysSinceFirstSession
  };
}

function estimateDaysToTarget(current: number, target: number, ratePerDay: number): number | null {
  if (ratePerDay <= 0) return null;
  const remaining = target - current;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / ratePerDay);
}

export function calculateAwardPredictions(
  sessions: Session[],
  earnedAwardIds: Set<string>
): Map<string, AwardPrediction> {
  const predictions = new Map<string, AwardPrediction>();
  
  if (sessions.length === 0) return predictions;

  const stats = calculateStats(sessions);
  const today = new Date();

  // Process each un-earned award
  for (const award of AWARDS) {
    if (earnedAwardIds.has(award.id)) continue;

    let prediction: AwardPrediction | null = null;

    // Session count awards
    if (award.id.startsWith('sessions-')) {
      const target = parseInt(award.id.split('-')[1]);
      const current = stats.totalSessions;
      const progress = Math.min(100, (current / target) * 100);
      const sessionsPerDay = stats.avgSessionsPerWeek / 7;
      const daysRemaining = estimateDaysToTarget(current, target, sessionsPerDay);
      
      prediction = {
        awardId: award.id,
        criteria: { type: 'total_sessions', value: target, comparison: 'gte' },
        currentProgress: progress,
        targetValue: target,
        currentValue: current,
        unit: 'sessions',
        targetDate: daysRemaining !== null ? new Date(today.getTime() + daysRemaining * 24 * 60 * 60 * 1000) : null,
        daysRemaining,
        isAchievable: sessionsPerDay > 0
      };
    }

    // Duration awards
    else if (award.id.startsWith('duration-')) {
      const match = award.id.match(/duration-(\d+)h/);
      if (match) {
        const targetHours = parseInt(match[1]);
        const targetSeconds = targetHours * 3600;
        const current = stats.totalDuration;
        const progress = Math.min(100, (current / targetSeconds) * 100);
        const durationPerDay = (stats.avgDurationPerSession * stats.avgSessionsPerWeek) / 7;
        const daysRemaining = estimateDaysToTarget(current, targetSeconds, durationPerDay);
        
        prediction = {
          awardId: award.id,
          criteria: { type: 'total_duration', value: targetSeconds, comparison: 'gte' },
          currentProgress: progress,
          targetValue: targetHours,
          currentValue: Math.round(current / 3600 * 10) / 10,
          unit: 'hours',
          targetDate: daysRemaining !== null ? new Date(today.getTime() + daysRemaining * 24 * 60 * 60 * 1000) : null,
          daysRemaining,
          isAchievable: durationPerDay > 0
        };
      }
    }

    // Distance awards
    else if (award.id.startsWith('dist-')) {
      let targetMeters = 0;
      if (award.id === 'dist-10k') targetMeters = 10000;
      else if (award.id === 'dist-50k') targetMeters = 50000;
      else if (award.id === 'dist-100k') targetMeters = 100000;
      else if (award.id === 'dist-250k') targetMeters = 250000;
      else if (award.id === 'dist-500k') targetMeters = 500000;
      else if (award.id === 'dist-750k') targetMeters = 750000;
      else if (award.id === 'dist-1m') targetMeters = 1000000;

      if (targetMeters > 0) {
        const current = stats.totalDistance;
        const progress = Math.min(100, (current / targetMeters) * 100);
        const distancePerDay = (stats.avgDistancePerSession * stats.avgSessionsPerWeek) / 7;
        const daysRemaining = estimateDaysToTarget(current, targetMeters, distancePerDay);
        
        prediction = {
          awardId: award.id,
          criteria: { type: 'total_distance', value: targetMeters, comparison: 'gte' },
          currentProgress: progress,
          targetValue: targetMeters / 1000,
          currentValue: Math.round(current / 100) / 10,
          unit: 'km',
          targetDate: daysRemaining !== null ? new Date(today.getTime() + daysRemaining * 24 * 60 * 60 * 1000) : null,
          daysRemaining,
          isAchievable: distancePerDay > 0
        };
      }
    }

    // Streak awards
    else if (award.id.startsWith('streak-')) {
      const target = parseInt(award.id.split('-')[1]);
      const current = stats.bestStreak;
      const progress = Math.min(100, (current / target) * 100);
      
      // Streak prediction is tricky - assume they maintain current streak
      const daysRemaining = stats.currentStreak > 0 ? Math.max(0, target - stats.currentStreak) : null;
      
      prediction = {
        awardId: award.id,
        criteria: { type: 'streak_days', value: target, comparison: 'gte' },
        currentProgress: progress,
        targetValue: target,
        currentValue: current,
        unit: 'days',
        targetDate: daysRemaining !== null && daysRemaining > 0 
          ? new Date(today.getTime() + daysRemaining * 24 * 60 * 60 * 1000) 
          : null,
        daysRemaining,
        isAchievable: stats.currentStreak > 0 || stats.avgSessionsPerWeek >= 5
      };
    }

    // Power awards
    else if (award.id.startsWith('power-')) {
      const target = parseInt(award.id.split('-')[1]);
      const current = stats.bestPower;
      const progress = Math.min(100, (current / target) * 100);
      
      // Power improvement is harder to predict - use rough estimate
      const powerGrowthPerWeek = stats.daysSinceFirstSession > 30 
        ? (stats.bestPower - stats.avgPower) / (stats.daysSinceFirstSession / 7)
        : 0;
      const weeksRemaining = powerGrowthPerWeek > 0 
        ? Math.ceil((target - current) / powerGrowthPerWeek)
        : null;
      
      prediction = {
        awardId: award.id,
        criteria: { type: 'single_session_power', value: target, comparison: 'gte' },
        currentProgress: progress,
        targetValue: target,
        currentValue: Math.round(current),
        unit: 'watts',
        targetDate: weeksRemaining !== null && weeksRemaining > 0
          ? new Date(today.getTime() + weeksRemaining * 7 * 24 * 60 * 60 * 1000)
          : null,
        daysRemaining: weeksRemaining !== null ? weeksRemaining * 7 : null,
        isAchievable: current >= target * 0.7 // Within 30% of target
      };
    }

    // Improvement awards - harder to predict, show progress only
    // Award conditions require: sessions.length >= 10 AND valid.length >= 5
    else if (award.id.startsWith('improve-')) {
      const sorted = [...sessions].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const valid = sorted.filter(s => s.duration > 300);
      
      // Match award condition requirements: 10+ total sessions, 5+ valid sessions
      if (sessions.length >= 10 && valid.length >= 5) {
        const baseline = valid.slice(0, 3).reduce((acc, s) => acc + s.avgPower, 0) / 3;
        const best = Math.max(...valid.map(s => s.avgPower));
        
        // Check longer strings first to avoid partial matches (e.g., '100' contains '10')
        let targetMultiplier = 1;
        if (award.id.includes('100')) targetMultiplier = 2.0;
        else if (award.id.includes('75')) targetMultiplier = 1.75;
        else if (award.id.includes('50')) targetMultiplier = 1.50;
        else if (award.id.includes('25')) targetMultiplier = 1.25;
        else if (award.id.includes('10')) targetMultiplier = 1.10;
        
        const targetPower = baseline * targetMultiplier;
        const progress = Math.min(100, ((best - baseline) / (targetPower - baseline)) * 100);
        
        // If progress is 100% but award not earned, there's a data mismatch - cap at 99%
        const cappedProgress = progress >= 100 ? 99 : progress;
        
        // Estimate target date based on power improvement rate
        const powerGained = best - baseline;
        const powerNeeded = targetPower - best;
        let estimatedDays: number | null = null;
        let estimatedDate: Date | null = null;
        
        if (powerGained > 0 && powerNeeded > 0 && stats.daysSinceFirstSession > 7) {
          const powerPerDay = powerGained / stats.daysSinceFirstSession;
          estimatedDays = Math.ceil(powerNeeded / powerPerDay);
          estimatedDate = new Date(today.getTime() + estimatedDays * 24 * 60 * 60 * 1000);
        }
        
        prediction = {
          awardId: award.id,
          criteria: { type: 'custom', value: Math.round(targetPower), comparison: 'gte' },
          currentProgress: Math.max(0, cappedProgress),
          targetValue: Math.round(targetPower),
          currentValue: Math.round(best),
          unit: `watts (baseline: ${Math.round(baseline)}W)`,
          targetDate: estimatedDate,
          daysRemaining: estimatedDays,
          isAchievable: best >= baseline * 0.9 // Making some progress
        };
      } else if (valid.length >= 3) {
        // Not enough sessions yet - show progress toward having enough data
        const baseline = valid.slice(0, 3).reduce((acc, s) => acc + s.avgPower, 0) / 3;
        const best = Math.max(...valid.map(s => s.avgPower));
        
        let targetMultiplier = 1;
        // Check longer strings first to avoid partial matches (e.g., '100' contains '10')
        if (award.id.includes('100')) targetMultiplier = 2.0;
        else if (award.id.includes('75')) targetMultiplier = 1.75;
        else if (award.id.includes('50')) targetMultiplier = 1.50;
        else if (award.id.includes('25')) targetMultiplier = 1.25;
        else if (award.id.includes('10')) targetMultiplier = 1.10;
        
        const targetPower = baseline * targetMultiplier;
        const powerProgress = ((best - baseline) / (targetPower - baseline)) * 100;
        
        // Factor in session requirements: need 10 sessions and 5 valid
        const sessionProgress = Math.min(100, (sessions.length / 10) * 100);
        const validProgress = Math.min(100, (valid.length / 5) * 100);
        
        // Combined progress: weight power progress but cap by session requirements
        const combinedProgress = Math.min(
          Math.max(0, powerProgress),
          sessionProgress,
          validProgress
        );
        
        // Estimate when we'll have enough sessions
        const sessionsNeeded = Math.max(0, 10 - sessions.length);
        const daysForSessions = stats.avgSessionsPerWeek > 0 
          ? Math.ceil(sessionsNeeded / (stats.avgSessionsPerWeek / 7))
          : null;
        
        prediction = {
          awardId: award.id,
          criteria: { type: 'custom', value: Math.round(targetPower), comparison: 'gte' },
          currentProgress: Math.max(0, Math.min(99, combinedProgress)),
          targetValue: Math.round(targetPower),
          currentValue: Math.round(best),
          unit: `watts (need ${sessionsNeeded} more sessions)`,
          targetDate: daysForSessions ? new Date(today.getTime() + daysForSessions * 24 * 60 * 60 * 1000) : null,
          daysRemaining: daysForSessions,
          isAchievable: true
        };
      }
    }

    // Speed awards (500m pace targets)
    else if (award.id === 'speed-demon' || award.id === 'speed-light') {
      const targetSplit = award.id === 'speed-demon' ? 105 : 95; // 1:45 or 1:35 in seconds
      
      // Find best 500m pace from sessions
      const sessions500m = sessions.filter(s => s.distance === 500);
      const bestSplit = sessions500m.length > 0 
        ? Math.min(...sessions500m.map(s => s.avgSplit || Infinity))
        : null;
      
      if (bestSplit !== null && bestSplit < Infinity) {
        const progress = Math.min(100, ((180 - bestSplit) / (180 - targetSplit)) * 100);
        
        // Estimate improvement rate
        const splitImprovement = stats.daysSinceFirstSession > 14 && sessions500m.length >= 2
          ? (sessions500m[0].avgSplit - bestSplit) / stats.daysSinceFirstSession
          : 0;
        const daysRemaining = splitImprovement > 0 && bestSplit > targetSplit
          ? Math.ceil((bestSplit - targetSplit) / splitImprovement)
          : null;
        
        prediction = {
          awardId: award.id,
          criteria: { type: 'single_session_pace', value: targetSplit, comparison: 'lte' },
          currentProgress: Math.max(0, progress),
          targetValue: targetSplit,
          currentValue: Math.round(bestSplit),
          unit: `sec/500m (target: ${Math.floor(targetSplit / 60)}:${String(targetSplit % 60).padStart(2, '0')})`,
          targetDate: daysRemaining ? new Date(today.getTime() + daysRemaining * 24 * 60 * 60 * 1000) : null,
          daysRemaining,
          isAchievable: bestSplit <= targetSplit * 1.2
        };
      } else {
        // No 500m sessions yet - show as 0% with guidance
        prediction = {
          awardId: award.id,
          criteria: { type: 'single_session_pace', value: targetSplit, comparison: 'lte' },
          currentProgress: 0,
          targetValue: targetSplit,
          currentValue: 0,
          unit: `sec/500m (need 500m sessions)`,
          targetDate: null,
          daysRemaining: null,
          isAchievable: true
        };
      }
    }

    // Pace improvement awards
    else if (award.id.startsWith('improve-pace-')) {
      const sorted = [...sessions].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const valid = sorted.filter(s => s.duration > 300 && s.avgSplit > 0);
      
      if (sessions.length >= 10 && valid.length >= 5) {
        const baseline = valid.slice(0, 3).reduce((acc, s) => acc + s.avgSplit, 0) / 3;
        const best = Math.min(...valid.map(s => s.avgSplit));
        
        // Check longer strings first
        let targetImprovement = 0;
        if (award.id.includes('10')) targetImprovement = 0.10;
        else if (award.id.includes('5')) targetImprovement = 0.05;
        
        const targetSplit = baseline * (1 - targetImprovement);
        const improvement = (baseline - best) / baseline;
        const progress = Math.min(100, (improvement / targetImprovement) * 100);
        
        const cappedProgress = progress >= 100 ? 99 : progress;
        
        // Estimate based on pace improvement rate
        const paceImproved = baseline - best;
        const paceNeeded = best - targetSplit;
        let estimatedDays: number | null = null;
        
        if (paceImproved > 0 && paceNeeded > 0 && stats.daysSinceFirstSession > 7) {
          const pacePerDay = paceImproved / stats.daysSinceFirstSession;
          estimatedDays = Math.ceil(paceNeeded / pacePerDay);
        }
        
        prediction = {
          awardId: award.id,
          criteria: { type: 'custom', value: Math.round(targetSplit), comparison: 'lte' },
          currentProgress: Math.max(0, cappedProgress),
          targetValue: Math.round(targetSplit),
          currentValue: Math.round(best),
          unit: `sec/500m (baseline: ${Math.round(baseline)}s)`,
          targetDate: estimatedDays ? new Date(today.getTime() + estimatedDays * 24 * 60 * 60 * 1000) : null,
          daysRemaining: estimatedDays,
          isAchievable: best <= baseline
        };
      } else if (valid.length >= 3) {
        const baseline = valid.slice(0, 3).reduce((acc, s) => acc + s.avgSplit, 0) / 3;
        const best = Math.min(...valid.map(s => s.avgSplit));
        
        let targetImprovement = 0;
        if (award.id.includes('10')) targetImprovement = 0.10;
        else if (award.id.includes('5')) targetImprovement = 0.05;
        
        const targetSplit = baseline * (1 - targetImprovement);
        const improvement = (baseline - best) / baseline;
        const paceProgress = (improvement / targetImprovement) * 100;
        
        const sessionProgress = Math.min(100, (sessions.length / 10) * 100);
        const validProgress = Math.min(100, (valid.length / 5) * 100);
        const combinedProgress = Math.min(Math.max(0, paceProgress), sessionProgress, validProgress);
        
        const sessionsNeeded = Math.max(0, 10 - sessions.length);
        const daysForSessions = stats.avgSessionsPerWeek > 0 
          ? Math.ceil(sessionsNeeded / (stats.avgSessionsPerWeek / 7))
          : null;
        
        prediction = {
          awardId: award.id,
          criteria: { type: 'custom', value: Math.round(targetSplit), comparison: 'lte' },
          currentProgress: Math.max(0, Math.min(99, combinedProgress)),
          targetValue: Math.round(targetSplit),
          currentValue: Math.round(best),
          unit: `sec/500m (need ${sessionsNeeded} more sessions)`,
          targetDate: daysForSessions ? new Date(today.getTime() + daysForSessions * 24 * 60 * 60 * 1000) : null,
          daysRemaining: daysForSessions,
          isAchievable: true
        };
      }
    }

    // Time-based awards (early bird, night owl)
    else if (award.id === 'early-bird' || award.id === 'night-owl') {
      // These are binary - either you've done it or not
      // Show as "achievable anytime" with 0% progress
      prediction = {
        awardId: award.id,
        criteria: { type: 'custom', value: award.id === 'early-bird' ? 8 : 21, comparison: award.id === 'early-bird' ? 'lte' : 'gte' },
        currentProgress: 0,
        targetValue: award.id === 'early-bird' ? 8 : 21,
        currentValue: 0,
        unit: award.id === 'early-bird' ? 'AM (row before 8 AM)' : 'PM (row after 9 PM)',
        targetDate: null,
        daysRemaining: null,
        isAchievable: true
      };
    }

    if (prediction) {
      predictions.set(award.id, prediction);
    }
  }

  return predictions;
}

export function formatPrediction(prediction: AwardPrediction): string {
  if (prediction.daysRemaining === null || prediction.daysRemaining <= 0) {
    return `${Math.round(prediction.currentProgress)}% complete`;
  }
  
  if (prediction.daysRemaining <= 7) {
    return `~${prediction.daysRemaining} day${prediction.daysRemaining === 1 ? '' : 's'} away`;
  }
  
  if (prediction.daysRemaining <= 30) {
    const weeks = Math.round(prediction.daysRemaining / 7);
    return `~${weeks} week${weeks === 1 ? '' : 's'} away`;
  }
  
  if (prediction.daysRemaining <= 365) {
    const months = Math.round(prediction.daysRemaining / 30);
    return `~${months} month${months === 1 ? '' : 's'} away`;
  }
  
  const years = Math.round(prediction.daysRemaining / 365 * 10) / 10;
  return `~${years} year${years === 1 ? '' : 's'} away`;
}
