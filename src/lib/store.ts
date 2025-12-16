import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Session, SessionStats, PersonalRecord, SessionFilters, StrokeData } from '@/types/session';
import { AWARDS, EarnedAward } from '@/lib/awards';

// Chart configuration types
export type ChartMetric = 'distance' | 'pace' | 'power' | 'strokeRate' | 'energy' | 'duration' | 'splitTime' | 'consistencyScore';
type ChartType = 'line' | 'bar' | 'area';

// Unified Time Range Type - used across Dashboard, Analytics, and Sessions
export type TimeRange = '7days' | '30days' | '90days' | 'all';

// Dashboard Persistence Types
export type DashboardTimeRange = TimeRange; // Alias for backward compatibility
export type ComparisonMetric = 'distance' | 'duration' | 'energy' | 'power' | 'pace' | 'strokeRate';
export type ComparisonPeriod = 'week' | 'month' | 'quarter' | 'year';
export type ComparisonChartType = 'bar' | 'line' | 'area';

export interface DashboardSettings {
  timeRange: TimeRange;
  comparisonWidget: {
    metric: ComparisonMetric;
    period: ComparisonPeriod;
    chartType: ComparisonChartType;
  };
  periodStats: {
    periodA: string;
    periodB: string;
  };
}

// Sessions View Persistence Types
export type SessionsDateFilter = TimeRange; // Unified with Dashboard/Analytics
export type SessionsDistanceFilter = 'all' | '100' | '500' | '1000' | '2000' | '5000+';

export interface SessionsViewSettings {
  filters: {
    dateRange: TimeRange;
    distanceRange: SessionsDistanceFilter;
  };
  sortConfig: {
    field: 'date' | 'distance' | 'pace' | 'power';
    direction: 'asc' | 'desc';
  };
}

export type ChartZoomKey = 'pace' | 'work' | 'strokeLength' | 'rollingPower' | 'rollingSplit';

export interface SessionAnalysisSettings {
  activeTab: 'overview' | 'charts' | 'segments' | 'analysis';
  segmentSize: 100 | 500;
  chartZoom: Record<ChartZoomKey, boolean>; // Per-chart zoom toggle (true = zoomed/dynamic, false = full range)
}

// Chart explanation from AI
export interface ChartExplanation {
  summary: string;
  fullResponse: string; // Complete AI response for tooltip display
  chatSessionId: string;
  chartTitle: string;
  generatedAt: Date;
}

// Pending chart explanation data (for passing to chat)
export interface PendingChartExplanation {
  chartId: string;
  chartTitle: string;
  prompt: string;
  screenshot?: string; // base64 data URL
  fullData?: string; // JSON stringified data
}

export type AIAwardSuggestionStatus = 'suggested' | 'approved';

export interface AIAwardSuggestion {
  awardId: string;
  status: AIAwardSuggestionStatus;
  rationale: string;
  targetDate?: Date;
  suggestedAt: Date;
  approvedAt?: Date;
  model?: string;
}

// Smoothing option type
export type SmoothingOption = 0 | 3 | 5 | 10;

// Global analytics chart settings
export interface AnalyticsChartSettings {
  // Global date range - applies to all charts
  dateRangeFrom: string | null; // ISO date string
  dateRangeTo: string | null; // ISO date string
  // Global smoothing selector (applies to all charts)
  smoothingAll?: SmoothingOption;
  // Per-chart smoothing settings
  smoothing: Record<ChartMetric, SmoothingOption>;
  // Per-chart zoom settings (true = zoomed/dynamic, false = full range)
  chartZoom?: Record<ChartMetric, boolean>;
}

interface ChartSettings {
  enabledCharts: ChartMetric[];
  chartType: ChartType;
  analyticsSettings: AnalyticsChartSettings;
}

interface RowingStore {
  // State
  sessions: Session[];
  personalRecords: PersonalRecord[];
  earnedAwards: EarnedAward[];
  aiAwardSuggestions: AIAwardSuggestion[];
  newlyEarnedAward: EarnedAward | null; // For notification
  filters: SessionFilters;
  chartSettings: ChartSettings;
  dashboardSettings: DashboardSettings;
  sessionsViewSettings: SessionsViewSettings;
  sessionAnalysisSettings: SessionAnalysisSettings;
  chartExplanations: Record<string, ChartExplanation>; // keyed by chartId
  pendingChartExplanation: PendingChartExplanation | null; // temporary storage for chat handoff
  
  // Actions
  addSessions: (sessions: Session[]) => void;
  clearSessions: () => void;
  updateFilters: (filters: Partial<SessionFilters>) => void;
  resetFilters: () => void;
  deleteSession: (sessionId: string) => void;
  updateSession: (updatedSession: Session) => void;
  updateChartSettings: (settings: Partial<ChartSettings>) => void;
  resetChartSettings: () => void;
  dismissNewAward: () => void;

  upsertAIAwardSuggestion: (suggestion: Omit<AIAwardSuggestion, 'suggestedAt'> & { suggestedAt?: Date }) => void;
  approveAIAwardSuggestion: (awardId: string) => void;
  deleteAIAwardSuggestion: (awardId: string) => void;
  
  updateDashboardSettings: (settings: Partial<DashboardSettings> | Partial<DashboardSettings['comparisonWidget']> | Partial<DashboardSettings['periodStats']>) => void;
  updateSessionsViewSettings: (settings: Partial<SessionsViewSettings> | Partial<SessionsViewSettings['filters']> | Partial<SessionsViewSettings['sortConfig']>) => void;
  updateSessionAnalysisSettings: (settings: Partial<SessionAnalysisSettings>) => void;
  setChartExplanation: (chartId: string, explanation: ChartExplanation) => void;
  getChartExplanation: (chartId: string) => ChartExplanation | undefined;
  removeChartExplanationsBySessionId: (sessionId: string) => void;
  clearAllChartExplanations: () => void;
  setPendingChartExplanation: (data: PendingChartExplanation | null) => void;
  getPendingChartExplanation: () => PendingChartExplanation | null;
  
  // Computed getters
  getSessions: () => Session[];
  getFilteredSessions: () => Session[];
  getStats: () => SessionStats;
  getPersonalRecords: () => PersonalRecord[];
  getSessionById: (id: string) => Session | undefined;
  getChartSettings: () => ChartSettings;
}

const defaultFilters: SessionFilters = {
  sortBy: 'date',
  sortOrder: 'desc'
};

const defaultAnalyticsSettings: AnalyticsChartSettings = {
  dateRangeFrom: null,
  dateRangeTo: null,
  smoothingAll: 0,
  smoothing: {
    distance: 0,
    pace: 0,
    power: 0,
    strokeRate: 0,
    energy: 0,
    duration: 0,
    splitTime: 3, // Default to 3 for pace analysis (already had moving average)
    consistencyScore: 0
  },
  chartZoom: {
    distance: true,
    pace: true,
    power: true,
    strokeRate: true,
    energy: true,
    duration: true,
    splitTime: true,
    consistencyScore: true
  }
};

const defaultChartSettings: ChartSettings = {
  enabledCharts: ['distance', 'power', 'pace'],
  chartType: 'line',
  analyticsSettings: defaultAnalyticsSettings
};

const defaultDashboardSettings: DashboardSettings = {
  timeRange: 'all',
  comparisonWidget: {
    metric: 'distance',
    period: 'week',
    chartType: 'bar'
  },
  periodStats: {
    periodA: '',
    periodB: ''
  }
};

const defaultSessionsViewSettings: SessionsViewSettings = {
  filters: {
    dateRange: 'all',
    distanceRange: 'all'
  },
  sortConfig: {
    field: 'date',
    direction: 'desc'
  }
};

const defaultSessionAnalysisSettings: SessionAnalysisSettings = {
  activeTab: 'overview',
  segmentSize: 500,
  chartZoom: {
    pace: true,
    work: true,
    strokeLength: true,
    rollingPower: true,
    rollingSplit: true
  }
};

// Helpers to determine when an award was actually earned
function sortSessionsByDate(sessions: Session[]): Session[] {
  return [...sessions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function computeAwardEarnedAt(sessions: Session[], awardId: string): Date | null {
  const sorted = sortSessionsByDate(sessions);
  for (let i = 0; i < sorted.length; i++) {
    const prefix = sorted.slice(0, i + 1);
    const stats = calculateStats(prefix);
    const award = AWARDS.find(a => a.id === awardId);
    if (!award) continue;
    if (award.condition(prefix, stats)) {
      return new Date(sorted[i].timestamp);
    }
  }
  return null;
}

function computeAllEarnedAwards(sessions: Session[]): EarnedAward[] {
  const earned: EarnedAward[] = [];
  AWARDS.forEach(award => {
    const earnedAt = computeAwardEarnedAt(sessions, award.id);
    if (earnedAt) {
      earned.push({ awardId: award.id, earnedAt });
    }
  });
  return earned;
}

// Calculate personal records from sessions
function calculatePersonalRecords(sessions: Session[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  
  // Standard distances to track (including 100m)
  const distances = [100, 500, 1000, 2000, 5000];
  
  distances.forEach(distance => {
    // Find sessions that exactly match this distance
    const matchingSessions = sessions.filter(session => session.distance === distance);
    
    if (matchingSessions.length > 0) {
      // Find the fastest time (lowest duration)
      const bestSession = matchingSessions.reduce((best, current) => 
        current.duration < best.duration ? current : best
      );
      
      records.push({
        distance,
        bestTime: bestSession.duration,
        bestPace: bestSession.avgSplit,
        date: bestSession.timestamp,
        avgPower: bestSession.avgPower,
        sessionId: bestSession.id
      });
    }
  });
  
  return records;
}

// Calculate session statistics
function calculateStats(sessions: Session[]): SessionStats {
  if (sessions.length === 0) {
    return {
      totalDistance: 0,
      totalTime: 0,
      totalSessions: 0,
      avgPace: 0,
      avgPower: 0,
      avgStrokeRate: 0,
      currentStreak: 0,
      bestStreak: 0
    };
  }

  const totalDistance = sessions.reduce((sum, session) => sum + session.distance, 0);
  const totalTime = sessions.reduce((sum, session) => sum + session.duration, 0);
  
  // Calculate averages (excluding zero values)
  const validPaceSessions = sessions.filter(s => s.avgSplit > 0);
  const avgPace = validPaceSessions.length > 0 
    ? validPaceSessions.reduce((sum, s) => sum + s.avgSplit, 0) / validPaceSessions.length 
    : 0;
    
  const validPowerSessions = sessions.filter(s => s.avgPower > 0);
  const avgPower = validPowerSessions.length > 0 
    ? validPowerSessions.reduce((sum, s) => sum + s.avgPower, 0) / validPowerSessions.length 
    : 0;
    
  const validStrokeRateSessions = sessions.filter(s => s.avgStrokeRate > 0);
  const avgStrokeRate = validStrokeRateSessions.length > 0 
    ? validStrokeRateSessions.reduce((sum, s) => sum + s.avgStrokeRate, 0) / validStrokeRateSessions.length 
    : 0;

  // Calculate streaks
  const { currentStreak, bestStreak } = calculateStreaks(sessions);

  return {
    totalDistance,
    totalTime,
    totalSessions: sessions.length,
    avgPace,
    avgPower,
    avgStrokeRate,
    currentStreak,
    bestStreak
  };
}

// Calculate consecutive day streaks
function calculateStreaks(sessions: Session[]): { currentStreak: number; bestStreak: number } {
  if (sessions.length === 0) return { currentStreak: 0, bestStreak: 0 };

  // Get unique dates (YYYY-MM-DD) and sort them - with defensive programming
  const uniqueDates = Array.from(
    new Set(sessions.map(s => {
      const timestamp = s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp);
      return timestamp.toISOString().split('T')[0];
    }))
  ).sort().reverse(); // Most recent first

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Check if there's a session today or yesterday to start current streak
  const hasRecentSession = uniqueDates.includes(today) || uniqueDates.includes(yesterday);
  
  if (hasRecentSession) {
    for (let i = 0; i < uniqueDates.length; i++) {
      const currentDate = new Date(uniqueDates[i]);
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      
      if (currentDate.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate best streak
  tempStreak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const currentDate = new Date(uniqueDates[i]);
    const previousDate = new Date(uniqueDates[i - 1]);
    const diffDays = (previousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (diffDays === 1) {
      tempStreak++;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  bestStreak = Math.max(bestStreak, tempStreak);

  return { currentStreak, bestStreak };
}

// Filter and sort sessions
function filterAndSortSessions(sessions: Session[], filters: SessionFilters): Session[] {
  let filtered = [...sessions];

  // Date range filter
  if (filters.dateRange) {
    filtered = filtered.filter(session => 
      session.timestamp >= filters.dateRange!.start && 
      session.timestamp <= filters.dateRange!.end
    );
  }

  // Distance range filter
  if (filters.distanceRange) {
    filtered = filtered.filter(session => 
      session.distance >= filters.distanceRange!.min && 
      session.distance <= filters.distanceRange!.max
    );
  }

  // Sorting
  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'date':
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
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

export const useRowingStore = create<RowingStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      personalRecords: [],
      earnedAwards: [],
      aiAwardSuggestions: [],
      newlyEarnedAward: null,
      filters: defaultFilters,
      chartSettings: defaultChartSettings,
      dashboardSettings: defaultDashboardSettings,
      sessionsViewSettings: defaultSessionsViewSettings,
      sessionAnalysisSettings: defaultSessionAnalysisSettings,
      chartExplanations: {},
      pendingChartExplanation: null,

      // Actions
      addSessions: (newSessions) => {
        set((state) => {
          const existingIds = new Set(state.sessions.map(s => s.id));
          const uniqueNewSessions = newSessions.filter(s => !existingIds.has(s.id));
          
          const updatedSessions = [...state.sessions, ...uniqueNewSessions];
          const updatedRecords = calculatePersonalRecords(updatedSessions);
          // Recompute award dates based on when conditions first became true
          const recomputedAwards = computeAllEarnedAwards(updatedSessions);

          // Determine newly earned awards compared to previous state for notification
          const previousAwardIds = new Set(state.earnedAwards.map(a => a.awardId));
          const newlyEarned = recomputedAwards.filter(a => !previousAwardIds.has(a.awardId));
          const newAward =
            newlyEarned.length > 0
              ? newlyEarned.reduce((latest, current) =>
                  current.earnedAt > latest.earnedAt ? current : latest
                )
              : null;
          
          return {
            sessions: updatedSessions,
            personalRecords: updatedRecords,
            earnedAwards: recomputedAwards,
            newlyEarnedAward: state.newlyEarnedAward || newAward // Keep existing if not dismissed
          };
        });
      },

      clearSessions: () => {
        set({
          sessions: [],
          personalRecords: [],
          earnedAwards: [],
          newlyEarnedAward: null
        });
      },

      updateFilters: (newFilters) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters }
        }));
      },

      resetFilters: () => {
        set({ filters: defaultFilters });
      },

      deleteSession: (sessionId) => {
        set((state) => {
          const updatedSessions = state.sessions.filter(s => s.id !== sessionId);
          const updatedRecords = calculatePersonalRecords(updatedSessions);
          
          return {
            sessions: updatedSessions,
            personalRecords: updatedRecords
          };
        });
      },

      updateSession: (updatedSession) => {
        set((state) => {
          const updatedSessions = state.sessions.map(s => 
            s.id === updatedSession.id ? updatedSession : s
          );
          // Recalculate records in case this update improved something (unlikely for just adding strokeData, but good practice)
          const updatedRecords = calculatePersonalRecords(updatedSessions);
          
          return {
            sessions: updatedSessions,
            personalRecords: updatedRecords
          };
        });
      },

      updateChartSettings: (newSettings) => {
        set((state) => ({
          chartSettings: { ...state.chartSettings, ...newSettings }
        }));
      },

      resetChartSettings: () => {
        set({ chartSettings: defaultChartSettings });
      },

      dismissNewAward: () => {
        set({ newlyEarnedAward: null });
      },

      upsertAIAwardSuggestion: (suggestion) => {
        set((state) => {
          const next: AIAwardSuggestion = {
            awardId: suggestion.awardId,
            status: suggestion.status,
            rationale: suggestion.rationale,
            targetDate: suggestion.targetDate,
            suggestedAt: suggestion.suggestedAt ?? new Date(),
            approvedAt: suggestion.approvedAt,
            model: suggestion.model
          };

          const existingIndex = state.aiAwardSuggestions.findIndex(s => s.awardId === suggestion.awardId);
          if (existingIndex === -1) {
            return { aiAwardSuggestions: [...state.aiAwardSuggestions, next] };
          }

          const updated = [...state.aiAwardSuggestions];
          updated[existingIndex] = { ...updated[existingIndex], ...next };
          return { aiAwardSuggestions: updated };
        });
      },

      approveAIAwardSuggestion: (awardId) => {
        set((state) => {
          const updated: AIAwardSuggestion[] = state.aiAwardSuggestions.map((s): AIAwardSuggestion => {
            if (s.awardId !== awardId) return s;
            if (s.status === 'approved') return s;
            return { ...s, status: 'approved' as AIAwardSuggestionStatus, approvedAt: new Date() };
          });
          return { aiAwardSuggestions: updated };
        });
      },

      deleteAIAwardSuggestion: (awardId) => {
        set((state) => ({
          aiAwardSuggestions: state.aiAwardSuggestions.filter(s => s.awardId !== awardId)
        }));
      },

      updateDashboardSettings: (newSettings) => {
        set((state) => {
          // Handle nested update for comparisonWidget
           if ('metric' in newSettings || 'period' in newSettings || 'chartType' in newSettings) {
               return {
                   dashboardSettings: {
                       ...state.dashboardSettings,
                       comparisonWidget: {
                           ...state.dashboardSettings.comparisonWidget,
                           ...newSettings
                       }
                   }
               }
           }

           // Handle nested update for periodStats
           if ('periodA' in newSettings || 'periodB' in newSettings) {
               return {
                   dashboardSettings: {
                       ...state.dashboardSettings,
                       periodStats: {
                           ...state.dashboardSettings.periodStats,
                           ...newSettings
                       }
                   }
               }
           }
           
           // Otherwise merge top level
           // Note: If newSettings contains nested objects (comparisonWidget, periodStats) as full/partial objects, this merge handles it if TS allows
           // But since we typed it as Union of Partials, we might need to be careful if someone passes { comparisonWidget: ... }
           // Current signature allows Partial<DashboardSettings>, so newSettings.comparisonWidget is valid.
           // But we need to deep merge if we want to preserve other fields in nested objects
           
           const updatedSettings = { ...state.dashboardSettings };
           
           if ('comparisonWidget' in newSettings && newSettings.comparisonWidget) {
               updatedSettings.comparisonWidget = { ...updatedSettings.comparisonWidget, ...newSettings.comparisonWidget };
           }
           
           if ('periodStats' in newSettings && newSettings.periodStats) {
               updatedSettings.periodStats = { ...updatedSettings.periodStats, ...newSettings.periodStats };
           }
           
           if ('timeRange' in newSettings) {
               updatedSettings.timeRange = newSettings.timeRange!;
           }
           
           return { dashboardSettings: updatedSettings };
        });
      },

      updateSessionsViewSettings: (newSettings) => {
          set((state) => {
              const updatedSettings = { ...state.sessionsViewSettings };
              
              // Check if input is filters partial
              if ('dateRange' in newSettings || 'distanceRange' in newSettings) {
                   updatedSettings.filters = { ...updatedSettings.filters, ...newSettings };
                   return { sessionsViewSettings: updatedSettings };
              }
              
              // Check if input is sortConfig partial
              if ('field' in newSettings || 'direction' in newSettings) {
                   updatedSettings.sortConfig = { ...updatedSettings.sortConfig, ...newSettings };
                    return { sessionsViewSettings: updatedSettings };
              }
              
              // Otherwise it's the root object partial (SessionsViewSettings)
              if ('filters' in newSettings && newSettings.filters) {
                  updatedSettings.filters = { ...updatedSettings.filters, ...newSettings.filters };
              }
              if ('sortConfig' in newSettings && newSettings.sortConfig) {
                  updatedSettings.sortConfig = { ...updatedSettings.sortConfig, ...newSettings.sortConfig };
              }
              
              return { sessionsViewSettings: updatedSettings };
          });
      },

      updateSessionAnalysisSettings: (settings) => {
        set((state) => ({
          sessionAnalysisSettings: {
            ...state.sessionAnalysisSettings,
            ...settings
          }
        }));
      },

      setChartExplanation: (chartId, explanation) => {
        set((state) => ({
          chartExplanations: {
            ...state.chartExplanations,
            [chartId]: explanation
          }
        }));
      },

      getChartExplanation: (chartId) => {
        return get().chartExplanations[chartId];
      },

      removeChartExplanationsBySessionId: (sessionId) => {
        set((state) => {
          const newExplanations = { ...state.chartExplanations };
          for (const [chartId, explanation] of Object.entries(newExplanations)) {
            if (explanation.chatSessionId === sessionId) {
              delete newExplanations[chartId];
            }
          }
          return { chartExplanations: newExplanations };
        });
      },

      clearAllChartExplanations: () => {
        set({ chartExplanations: {} });
      },

      setPendingChartExplanation: (data) => {
        set({ pendingChartExplanation: data });
      },

      getPendingChartExplanation: () => {
        return get().pendingChartExplanation;
      },

      // Computed getters
      getSessions: () => get().sessions,
      
      getFilteredSessions: () => {
        const { sessions, filters } = get();
        return filterAndSortSessions(sessions, filters);
      },

      getStats: () => {
        return calculateStats(get().sessions);
      },

      getPersonalRecords: () => {
        return get().personalRecords;
      },

      getSessionById: (id) => {
        return get().sessions.find(session => session.id === id);
      },

      getChartSettings: () => {
        return get().chartSettings;
      }
    }),
    {
      name: 'rowing-tracker-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist essential data, not computed values
      partialize: (state) => ({
        sessions: state.sessions,
        filters: state.filters,
        chartSettings: state.chartSettings,
        dashboardSettings: state.dashboardSettings,
        sessionsViewSettings: state.sessionsViewSettings,
        sessionAnalysisSettings: state.sessionAnalysisSettings,
        earnedAwards: state.earnedAwards,
        aiAwardSuggestions: state.aiAwardSuggestions,
        chartExplanations: state.chartExplanations
      }),
      // Convert string timestamps back to Date objects on rehydrate
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert timestamps from strings to Date objects
          state.sessions = state.sessions.map(session => ({
            ...session,
            timestamp: new Date(session.timestamp)
          }));
          // Re-compute personal records
          state.personalRecords = calculatePersonalRecords(state.sessions);
          
          // Rehydrate awards dates
          state.earnedAwards = computeAllEarnedAwards(state.sessions);

          // Rehydrate AI award suggestion dates
          state.aiAwardSuggestions = (state.aiAwardSuggestions || []).map((s: any) => ({
            ...s,
            suggestedAt: s.suggestedAt ? new Date(s.suggestedAt) : new Date(),
            targetDate: s.targetDate ? new Date(s.targetDate) : undefined,
            approvedAt: s.approvedAt ? new Date(s.approvedAt) : undefined
          }));
        }
      }
    }
  )
);
