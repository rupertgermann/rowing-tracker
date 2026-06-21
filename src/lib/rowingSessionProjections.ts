import type { Session, SessionFilters, SessionStats, PersonalRecord } from '@/types/session';
import { AWARDS, type EarnedAward } from '@/lib/awards';

export type ProjectionTimeRange = '7days' | '30days' | '90days' | 'all';
export type ProjectionDistanceFilter = 'all' | '100' | '500' | '1000' | '2000' | '5000+';

export interface SessionsViewProjectionSettings {
  filters: {
    dateRange: ProjectionTimeRange;
    distanceRange: ProjectionDistanceFilter;
  };
  sortConfig: {
    field: 'date' | 'distance' | 'pace' | 'power';
    direction: 'asc' | 'desc';
  };
}

export type AIAwardSuggestionStatus = 'suggested' | 'approved' | 'earned';

export interface AIAwardCriteria {
  type:
    | 'total_distance'
    | 'total_duration'
    | 'total_sessions'
    | 'single_session_distance'
    | 'single_session_duration'
    | 'single_session_power'
    | 'single_session_pace'
    | 'weekly_sessions'
    | 'streak_days'
    | 'custom';
  value: number;
  comparison: 'gte' | 'lte' | 'eq';
}

export interface AIAwardSuggestion {
  id: string;
  title: string;
  description: string;
  status: AIAwardSuggestionStatus;
  rationale: string;
  criteria?: AIAwardCriteria;
  targetDate?: Date;
  suggestedAt: Date;
  approvedAt?: Date;
  earnedAt?: Date;
  model?: string;
}

interface ProjectionOptions {
  now?: Date;
}

type SessionTimestampInput = { timestamp: Date | string };

function timestampMs(session: SessionTimestampInput): number {
  return session.timestamp instanceof Date
    ? session.timestamp.getTime()
    : new Date(session.timestamp).getTime();
}

function timestampDate(session: Session): Date {
  return session.timestamp instanceof Date
    ? session.timestamp
    : new Date(session.timestamp);
}

export function sortSessionsByDate<T extends SessionTimestampInput>(
  sessions: T[],
): T[] {
  return [...sessions].sort((a, b) => timestampMs(a) - timestampMs(b));
}

function emptySessionStats(): SessionStats {
  return {
    totalDistance: 0,
    totalTime: 0,
    totalSessions: 0,
    avgPace: 0,
    avgPower: 0,
    avgStrokeRate: 0,
    currentStreak: 0,
    bestStreak: 0,
  };
}

export function calculateSessionStats(
  sessions: Session[],
  options: ProjectionOptions = {},
): SessionStats {
  if (sessions.length === 0) {
    return emptySessionStats();
  }

  const totalDistance = sessions.reduce((sum, session) => sum + session.distance, 0);
  const totalTime = sessions.reduce((sum, session) => sum + session.duration, 0);
  const validPaceSessions = sessions.filter((session) => session.avgSplit > 0);
  const validPowerSessions = sessions.filter((session) => session.avgPower > 0);
  const validStrokeRateSessions = sessions.filter((session) => session.avgStrokeRate > 0);
  const { currentStreak, bestStreak } = calculateStreaks(sessions, options.now);

  return {
    totalDistance,
    totalTime,
    totalSessions: sessions.length,
    avgPace: validPaceSessions.length > 0
      ? validPaceSessions.reduce((sum, session) => sum + session.avgSplit, 0) / validPaceSessions.length
      : 0,
    avgPower: validPowerSessions.length > 0
      ? validPowerSessions.reduce((sum, session) => sum + session.avgPower, 0) / validPowerSessions.length
      : 0,
    avgStrokeRate: validStrokeRateSessions.length > 0
      ? validStrokeRateSessions.reduce((sum, session) => sum + session.avgStrokeRate, 0) / validStrokeRateSessions.length
      : 0,
    currentStreak,
    bestStreak,
  };
}

function calculateStreaks(
  sessions: Session[],
  now = new Date(),
): { currentStreak: number; bestStreak: number } {
  if (sessions.length === 0) return { currentStreak: 0, bestStreak: 0 };

  const uniqueDates = Array.from(
    new Set(
      sessions.map((session) => timestampDate(session).toISOString().split('T')[0]),
    ),
  ).sort().reverse();

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 1;

  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  const hasRecentSession = uniqueDates.includes(today) || uniqueDates.includes(yesterday);

  if (hasRecentSession) {
    for (let i = 0; i < uniqueDates.length; i++) {
      const currentDate = new Date(uniqueDates[i]);
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);

      if (currentDate.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  for (let i = 1; i < uniqueDates.length; i++) {
    const currentDate = new Date(uniqueDates[i]);
    const previousDate = new Date(uniqueDates[i - 1]);
    const diffDays = (previousDate.getTime() - currentDate.getTime()) / 86400000;

    if (diffDays === 1) {
      tempStreak += 1;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak);

  return { currentStreak, bestStreak };
}

export function calculatePersonalRecords(sessions: Session[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  const distances = [100, 500, 1000, 2000, 5000];

  distances.forEach((distance) => {
    const matchingSessions = sessions.filter((session) => session.distance === distance);
    if (matchingSessions.length === 0) return;

    const bestSession = matchingSessions.reduce((best, current) =>
      current.duration < best.duration ? current : best,
    );

    records.push({
      distance,
      bestTime: bestSession.duration,
      bestPace: bestSession.avgSplit,
      date: bestSession.timestamp,
      avgPower: bestSession.avgPower,
      sessionId: bestSession.id,
    });
  });

  return records;
}

export function filterAndSortSessions(sessions: Session[], filters: SessionFilters): Session[] {
  let filtered = [...sessions];

  if (filters.dateRange) {
    filtered = filtered.filter((session) =>
      timestampDate(session) >= filters.dateRange!.start &&
      timestampDate(session) <= filters.dateRange!.end,
    );
  }

  if (filters.distanceRange) {
    filtered = filtered.filter((session) =>
      session.distance >= filters.distanceRange!.min &&
      session.distance <= filters.distanceRange!.max,
    );
  }

  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'date':
          comparison = timestampMs(a) - timestampMs(b);
          break;
        case 'distance':
          comparison = a.distance - b.distance;
          break;
        case 'pace':
          comparison = a.avgSplit - b.avgSplit;
          break;
        case 'power':
          comparison = a.avgPower - b.avgPower;
          break;
      }

      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  return filtered;
}

export function filterAndSortSessionsForView(
  sessions: Session[],
  settings: SessionsViewProjectionSettings,
  options: ProjectionOptions = {},
): Session[] {
  const now = options.now ?? new Date();
  const { filters, sortConfig } = settings;

  const filtered = sessions.filter((session) => {
    if (filters.dateRange !== 'all') {
      const daysToFilter = {
        '7days': 7,
        '30days': 30,
        '90days': 90,
      }[filters.dateRange];

      if (daysToFilter) {
        const cutoffDate = new Date(now.getTime() - daysToFilter * 86400000);
        if (timestampDate(session) < cutoffDate) return false;
      }
    }

    if (filters.distanceRange !== 'all') {
      if (filters.distanceRange === '5000+') {
        if (session.distance < 5000) return false;
      } else if (session.distance !== Number.parseInt(filters.distanceRange, 10)) {
        return false;
      }
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    let comparison = 0;

    switch (sortConfig.field) {
      case 'date':
        comparison = timestampMs(a) - timestampMs(b);
        break;
      case 'distance':
        comparison = a.distance - b.distance;
        break;
      case 'pace':
        comparison = a.avgSplit - b.avgSplit;
        break;
      case 'power':
        comparison = a.avgPower - b.avgPower;
        break;
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });
}

export function computeAwardEarnedAt(
  sessions: Session[],
  awardId: string,
  options: ProjectionOptions = {},
): Date | null {
  const sorted = sortSessionsByDate(sessions);

  for (let i = 0; i < sorted.length; i++) {
    const prefix = sorted.slice(0, i + 1);
    const stats = calculateSessionStats(prefix, options);
    const award = AWARDS.find((candidate) => candidate.id === awardId);

    if (award?.condition(prefix, stats)) {
      return timestampDate(sorted[i]);
    }
  }

  return null;
}

export function computeEarnedAwards(
  sessions: Session[],
  options: ProjectionOptions = {},
): EarnedAward[] {
  const earned: EarnedAward[] = [];

  AWARDS.forEach((award) => {
    const earnedAt = computeAwardEarnedAt(sessions, award.id, options);
    if (earnedAt) {
      earned.push({ awardId: award.id, earnedAt });
    }
  });

  return earned;
}

export function evaluateAIAwardCriteria(
  criteria: AIAwardCriteria,
  sessions: Session[],
  stats: SessionStats,
): boolean {
  const compare = (actual: number, target: number, comparison: string): boolean => {
    switch (comparison) {
      case 'gte':
        return actual >= target;
      case 'lte':
        return actual <= target;
      case 'eq':
        return actual === target;
      default:
        return actual >= target;
    }
  };

  switch (criteria.type) {
    case 'total_distance':
      return compare(stats.totalDistance, criteria.value, criteria.comparison);
    case 'total_duration':
      return compare(stats.totalTime, criteria.value, criteria.comparison);
    case 'total_sessions':
      return compare(sessions.length, criteria.value, criteria.comparison);
    case 'single_session_distance':
      return sessions.some((session) => compare(session.distance, criteria.value, criteria.comparison));
    case 'single_session_duration':
      return sessions.some((session) => compare(session.duration, criteria.value, criteria.comparison));
    case 'single_session_power':
      return sessions.some((session) => session.avgPower > 0 && compare(session.avgPower, criteria.value, criteria.comparison));
    case 'single_session_pace':
      return sessions.some((session) => session.avgSplit > 0 && compare(session.avgSplit, criteria.value, criteria.comparison));
    case 'weekly_sessions': {
      const weekMap = new Map<string, number>();
      sessions.forEach((session) => {
        const date = timestampDate(session);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + 1);
      });
      return Array.from(weekMap.values()).some((count) => compare(count, criteria.value, criteria.comparison));
    }
    case 'streak_days':
      return compare(calculateStreaks(sessions).bestStreak, criteria.value, criteria.comparison);
    case 'custom':
    default:
      return false;
  }
}

export function computeAIAwardEarnedAt(
  sessions: Session[],
  criteria: AIAwardCriteria,
  options: ProjectionOptions = {},
): Date | null {
  const sorted = sortSessionsByDate(sessions);

  for (let i = 0; i < sorted.length; i++) {
    const prefix = sorted.slice(0, i + 1);
    const stats = calculateSessionStats(prefix, options);

    if (evaluateAIAwardCriteria(criteria, prefix, stats)) {
      return timestampDate(sorted[i]);
    }
  }

  return null;
}

export function checkAIAwardSuggestions(
  sessions: Session[],
  aiAwardSuggestions: AIAwardSuggestion[],
  options: ProjectionOptions = {},
): AIAwardSuggestion[] {
  return aiAwardSuggestions.map((suggestion) => {
    if (suggestion.status !== 'approved' || !suggestion.criteria) {
      return suggestion;
    }

    const earnedAt = computeAIAwardEarnedAt(sessions, suggestion.criteria, options);

    if (!earnedAt) {
      return suggestion;
    }

    return {
      ...suggestion,
      status: 'earned',
      earnedAt,
    };
  });
}

export function selectNewlyEarnedAward(
  previousEarnedAwards: EarnedAward[],
  nextEarnedAwards: EarnedAward[],
  previousAIAwards: AIAwardSuggestion[],
  nextAIAwards: AIAwardSuggestion[],
): EarnedAward | null {
  const previousAwardIds = new Set(previousEarnedAwards.map((award) => award.awardId));
  const newlyEarnedStatic = nextEarnedAwards.filter((award) => !previousAwardIds.has(award.awardId));
  const previousAIEarnedIds = new Set(
    previousAIAwards
      .filter((award) => award.status === 'earned')
      .map((award) => award.id),
  );
  const newlyEarnedAI = nextAIAwards.filter(
    (award) => award.status === 'earned' && !previousAIEarnedIds.has(award.id),
  );

  let newAward: EarnedAward | null = null;

  if (newlyEarnedStatic.length > 0) {
    newAward = newlyEarnedStatic.reduce((latest, current) =>
      current.earnedAt > latest.earnedAt ? current : latest,
    );
  }

  if (newlyEarnedAI.length > 0) {
    const latestAI = newlyEarnedAI.reduce((latest, current) =>
      (current.earnedAt ?? new Date()) > (latest.earnedAt ?? new Date()) ? current : latest,
    );

    if (!newAward || (latestAI.earnedAt && latestAI.earnedAt > newAward.earnedAt)) {
      newAward = { awardId: latestAI.id, earnedAt: latestAI.earnedAt ?? new Date() };
    }
  }

  return newAward;
}
