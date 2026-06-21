import { create } from 'zustand';
import { Session, SessionStats, PersonalRecord, SessionFilters } from '@/types/session';
import type { EarnedAward } from '@/lib/awards';
import { initializeStoreFromDB, saveAwardsToDB, saveChartSettingsToDB, saveSessionAnalysisSettingsToDB } from '@/lib/dataSync';
import { firstCleanCatchDate, CLEAN_CATCH_AWARD_ID } from '@/lib/postureAchievements';
import type { SessionFaultInput } from '@/lib/mocap/postureTrendAggregation';
import {
  calculatePersonalRecords as projectPersonalRecords,
  calculateSessionStats as projectSessionStats,
  checkAIAwardSuggestions as projectAIAwardSuggestions,
  computeEarnedAwards as projectEarnedAwards,
  filterAndSortSessions as projectFilteredSessions,
  selectNewlyEarnedAward as projectNewlyEarnedAward,
  type AIAwardSuggestion,
  type AIAwardSuggestionStatus,
} from '@/lib/rowingSessionProjections';

export type {
  AIAwardCriteria,
  AIAwardSuggestion,
  AIAwardSuggestionStatus,
} from '@/lib/rowingSessionProjections';

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

// Pending plan analysis data (for passing to chat)
export interface PendingPlanAnalysis {
  planId: string;
  planTitle: string;
  prompt: string;
  planData?: string; // JSON stringified plan data
}

// Pending insight discussion data (for passing to chat)
export interface PendingInsight {
  insightId: string;
  insightTitle: string;
  insightDescription: string;
  insightType: string;
  priority: string;
  prompt: string;
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
  pendingPlanAnalysis: PendingPlanAnalysis | null; // temporary storage for plan analysis chat handoff
  pendingInsight: PendingInsight | null; // temporary storage for insight discussion chat handoff

  // Actions
  addSessions: (sessions: Session[]) => void;
  clearSessions: () => void;
  updateFilters: (filters: Partial<SessionFilters>) => void;
  resetFilters: () => void;
  removeSessionFromStore: (sessionId: string) => void;
  updateSessionInStore: (updatedSession: Session) => void;
  updateSessionsInStore: (sessions: Session[]) => void;  // Update local state only, no DB save
  replaceSessionsInStore: (sessions: Session[]) => void;  // Replace local state only, no DB save
  updateChartSettings: (settings: Partial<ChartSettings>) => void;
  resetChartSettings: () => void;
  dismissNewAward: () => void;
  evaluatePostureAwards: (postureSessions: SessionFaultInput[]) => void;

  upsertAIAwardSuggestion: (suggestion: Omit<AIAwardSuggestion, 'suggestedAt'> & { suggestedAt?: Date }) => void;
  approveAIAwardSuggestion: (id: string) => void;
  markAIAwardEarned: (id: string) => void;
  deleteAIAwardSuggestion: (id: string) => void;

  updateDashboardSettings: (settings: Partial<DashboardSettings> | Partial<DashboardSettings['comparisonWidget']> | Partial<DashboardSettings['periodStats']>) => void;
  updateSessionsViewSettings: (settings: Partial<SessionsViewSettings> | Partial<SessionsViewSettings['filters']> | Partial<SessionsViewSettings['sortConfig']>) => void;
  updateSessionAnalysisSettings: (settings: Partial<SessionAnalysisSettings>) => void;
  setChartExplanation: (chartId: string, explanation: ChartExplanation) => void;
  getChartExplanation: (chartId: string) => ChartExplanation | undefined;
  removeChartExplanationsBySessionId: (sessionId: string) => void;
  clearAllChartExplanations: () => void;
  setPendingChartExplanation: (data: PendingChartExplanation | null) => void;
  getPendingChartExplanation: () => PendingChartExplanation | null;
  setPendingPlanAnalysis: (data: PendingPlanAnalysis | null) => void;
  getPendingPlanAnalysis: () => PendingPlanAnalysis | null;
  setPendingInsight: (data: PendingInsight | null) => void;
  getPendingInsight: () => PendingInsight | null;

  // Computed getters
  getSessions: () => Session[];
  getFilteredSessions: () => Session[];

  // Database sync
  initializeFromDB: () => Promise<void>;
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

export const useRowingStore = create<RowingStore>()((set, get) => ({
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
  pendingPlanAnalysis: null,
  pendingInsight: null,

  // Actions
  addSessions: (newSessions) => {
    console.log('[STORE] addSessions called with', newSessions.length, 'sessions');

    // Ensure all new sessions have Date objects for timestamps (revive from JSON strings)
    const revivedSessions = newSessions.map(s => ({
      ...s,
      timestamp: s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp)
    }));

    // Use timestamp+distance as key for deduplication (not ID, to handle CSV→DB ID replacement)
    const existingKeys = new Set(
      get().sessions.map(s => {
        const ts = s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp);
        return `${ts.getTime()}-${s.distance}`;
      })
    );
    const uniqueNewSessions = revivedSessions.filter(
      s => !existingKeys.has(`${s.timestamp.getTime()}-${s.distance}`)
    );

    console.log('[STORE] Unique new sessions:', uniqueNewSessions.length);

    set((state) => {
      const updatedSessions = [...state.sessions, ...uniqueNewSessions];

      // Recompute award dates based on when conditions first became true
      const recomputedAwards = projectEarnedAwards(updatedSessions);

      // Check AI awards for automatic completion
      const updatedAIAwards = projectAIAwardSuggestions(updatedSessions, state.aiAwardSuggestions);
      const newAward = projectNewlyEarnedAward(
        state.earnedAwards,
        recomputedAwards,
        state.aiAwardSuggestions,
        updatedAIAwards,
      );

      return {
        sessions: updatedSessions,
        earnedAwards: recomputedAwards,
        aiAwardSuggestions: updatedAIAwards,
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

  removeSessionFromStore: (sessionId) => {
    console.log('[STORE] removeSessionFromStore called for:', sessionId);

    set((state) => {
      const updatedSessions = state.sessions.filter(s => s.id !== sessionId);

      return {
        sessions: updatedSessions,
        earnedAwards: state.earnedAwards,
      };
    });
  },

  updateSessionInStore: (updatedSession) => {
    console.log('[STORE] updateSessionInStore called with session:', updatedSession.id);
    console.log('[STORE] Has stroke data:', !!updatedSession.strokeData, 'Count:', updatedSession.strokeData?.length);

    set((state) => {
      const revivedSession = {
        ...updatedSession,
        timestamp: updatedSession.timestamp instanceof Date
          ? updatedSession.timestamp
          : new Date(updatedSession.timestamp)
      };
      const hasExistingSession = state.sessions.some(s => s.id === updatedSession.id);
      const updatedSessions = state.sessions.map(s =>
        s.id === updatedSession.id ? revivedSession : s
      );
      if (!hasExistingSession) {
        updatedSessions.push(revivedSession);
      }

      return {
        sessions: updatedSessions
      };
    });
  },

  // Update multiple sessions in local store only (no DB save)
  // Used after bulk saves to sync local state
  updateSessionsInStore: (sessionsToUpdate) => {
    console.log('[STORE] updateSessionsInStore called with', sessionsToUpdate.length, 'sessions');

    // Revive timestamps before mapping
    const revivedUpdate = sessionsToUpdate.map(s => ({
      ...s,
      timestamp: s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp)
    }));

    set((state) => {
      const existingById = new Map(state.sessions.map(s => [s.id, s]));
      const sessionMap = new Map(revivedUpdate.map(s => {
        const existing = existingById.get(s.id);
        return [s.id, {
          ...s,
          strokeData: s.strokeData ?? existing?.strokeData,
          mocapSession: s.mocapSession === undefined ? existing?.mocapSession : s.mocapSession,
        }];
      }));
      const updatedSessions = state.sessions.map(s =>
        sessionMap.has(s.id) ? sessionMap.get(s.id)! : s
      );

      return {
        sessions: updatedSessions
      };
    });
  },

  replaceSessionsInStore: (sessionsToReplace) => {
    console.log('[STORE] replaceSessionsInStore called with', sessionsToReplace.length, 'sessions');

    set((state) => {
      const existingById = new Map(state.sessions.map(s => [s.id, s]));
      const revivedSessions = sessionsToReplace.map(s => {
        const existing = existingById.get(s.id);
        return {
          ...s,
          timestamp: s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp),
          strokeData: s.strokeData ?? existing?.strokeData,
        };
      });

      return {
        sessions: revivedSessions,
      };
    });
  },

  updateChartSettings: (newSettings) => {
    set((state) => {
      const updatedChartSettings = { ...state.chartSettings, ...newSettings };

      // Persist to database (async, non-blocking)
      saveChartSettingsToDB(updatedChartSettings)
        .then(result => {
          if (!result.success) {
            console.error('[STORE] Failed to save chart settings:', result.error);
          } else {
            console.log('[STORE] Chart settings saved to database');
          }
        })
        .catch(err => {
          console.error('[STORE] Error saving chart settings to database:', err);
        });

      return {
        chartSettings: updatedChartSettings
      };
    });
  },

  resetChartSettings: () => {
    set({ chartSettings: defaultChartSettings });
  },

  dismissNewAward: () => {
    set({ newlyEarnedAward: null });
  },

  evaluatePostureAwards: (postureSessions: SessionFaultInput[]) => {
    const state = get();
    const existingIds = new Set(state.earnedAwards.map((a) => a.awardId));
    if (existingIds.has(CLEAN_CATCH_AWARD_ID)) return;

    const earnedAt = firstCleanCatchDate(postureSessions);
    if (!earnedAt) return;

    const newAward: EarnedAward = { awardId: CLEAN_CATCH_AWARD_ID, earnedAt };
    const updatedAwards = [...state.earnedAwards, newAward];

    saveAwardsToDB([newAward]).catch((err) => {
      console.error('[STORE] Failed to save posture award:', err);
    });

    set({
      earnedAwards: updatedAwards,
      newlyEarnedAward: state.newlyEarnedAward || newAward,
    });
  },

  upsertAIAwardSuggestion: (suggestion) => {
    set((state) => {
      const next: AIAwardSuggestion = {
        id: suggestion.id,
        title: suggestion.title,
        description: suggestion.description,
        status: suggestion.status,
        rationale: suggestion.rationale,
        criteria: suggestion.criteria,
        targetDate: suggestion.targetDate,
        suggestedAt: suggestion.suggestedAt ?? new Date(),
        approvedAt: suggestion.approvedAt,
        model: suggestion.model
      };

      const existingIndex = state.aiAwardSuggestions.findIndex(s => s.id === suggestion.id);
      if (existingIndex === -1) {
        return { aiAwardSuggestions: [...state.aiAwardSuggestions, next] };
      }

      const updated = [...state.aiAwardSuggestions];
      updated[existingIndex] = { ...updated[existingIndex], ...next };
      return { aiAwardSuggestions: updated };
    });
  },

  approveAIAwardSuggestion: (id) => {
    set((state) => {
      const updated: AIAwardSuggestion[] = state.aiAwardSuggestions.map((s): AIAwardSuggestion => {
        if (s.id !== id) return s;
        if (s.status === 'approved') return s;
        return { ...s, status: 'approved' as AIAwardSuggestionStatus, approvedAt: new Date() };
      });
      return { aiAwardSuggestions: updated };
    });
  },

  markAIAwardEarned: (id) => {
    set((state) => {
      const updated: AIAwardSuggestion[] = state.aiAwardSuggestions.map((s): AIAwardSuggestion => {
        if (s.id !== id) return s;
        if (s.status === 'earned') return s;
        return { ...s, status: 'earned' as AIAwardSuggestionStatus, earnedAt: new Date() };
      });
      return { aiAwardSuggestions: updated };
    });
  },

  deleteAIAwardSuggestion: (id) => {
    set((state) => ({
      aiAwardSuggestions: state.aiAwardSuggestions.filter(s => s.id !== id)
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
    set((state) => {
      const updatedSettings = {
        ...state.sessionAnalysisSettings,
        ...settings
      };

      // Persist to database (async, non-blocking)
      saveSessionAnalysisSettingsToDB(updatedSettings)
        .then(result => {
          if (!result.success) {
            console.error('[STORE] Failed to save session analysis settings:', result.error);
          }
        })
        .catch(err => {
          console.error('[STORE] Error saving session analysis settings to database:', err);
        });

      return {
        sessionAnalysisSettings: updatedSettings
      };
    });
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

  setPendingPlanAnalysis: (data) => {
    set({ pendingPlanAnalysis: data });
  },

  getPendingPlanAnalysis: () => {
    return get().pendingPlanAnalysis;
  },

  setPendingInsight: (data) => {
    set({ pendingInsight: data });
  },

  getPendingInsight: () => {
    return get().pendingInsight;
  },

  // Computed getters
  getSessions: () => get().sessions,

  getFilteredSessions: () => {
    const { sessions, filters } = get();
    return projectFilteredSessions(sessions, filters);
  },

  getStats: () => {
    return projectSessionStats(get().sessions);
  },

  getPersonalRecords: () => {
    return projectPersonalRecords(get().sessions);
  },

  getSessionById: (id) => {
    return get().sessions.find(session => session.id === id);
  },

  getChartSettings: () => {
    return get().chartSettings;
  },

  // Initialize store from database
  initializeFromDB: async () => {
    try {
      const data = await initializeStoreFromDB();

      // Convert database awards to app format
      const earnedAwards = data.earnedAwards.map((a) => ({
        awardId: a.awardId,
        earnedAt: new Date(a.earnedAt as string | Date)
      }));

      // Load generated achievements into the achievement store
      if (data.generatedAchievements && data.generatedAchievements.length > 0) {
        const useAchievementStore = await import('@/lib/achievementStore').then(m => m.useAchievementStore);
        const { setGeneratedAchievement } = useAchievementStore.getState();

        for (const achievement of data.generatedAchievements) {
          if (achievement?.awardId) {
            setGeneratedAchievement(achievement.awardId, {
              awardId: achievement.awardId,
              title: '', // Will be filled by gallery when needed
              description: '', // Will be filled by gallery when needed
              earnedAt: achievement.earnedAt ? new Date(achievement.earnedAt) : undefined,
              story: achievement.story || undefined,
              imageUrl: achievement.imageUrl || undefined,
              hasImage: Boolean(achievement.hasImage) || Boolean(achievement.imageUrl),
              generatedAt: achievement.generatedAt ? new Date(achievement.generatedAt) : undefined,
            });
          }
        }
      }

      // Load chart settings from database, or use defaults
      const chartSettings = (data.chartSettings as unknown as ChartSettings | undefined) || defaultChartSettings;

      // Load session analysis settings from database, or use defaults
      const sessionAnalysisSettings = (data.sessionAnalysisSettings as unknown as SessionAnalysisSettings | undefined) || defaultSessionAnalysisSettings;

      set({
        earnedAwards,
        chartSettings,
        sessionAnalysisSettings
      });

    } catch (error) {
      console.error('[STORE] Failed to initialize from database:', error);
    }
  },
}));
