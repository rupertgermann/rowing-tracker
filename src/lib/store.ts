import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Session, SessionStats, PersonalRecord, SessionFilters } from '@/types/session';

// Chart configuration types
type ChartMetric = 'distance' | 'pace' | 'power' | 'strokeRate' | 'energy' | 'duration';
type ChartType = 'line' | 'bar' | 'area';

interface ChartSettings {
  enabledCharts: ChartMetric[];
  chartType: ChartType;
}

interface RowingStore {
  // State
  sessions: Session[];
  personalRecords: PersonalRecord[];
  filters: SessionFilters;
  chartSettings: ChartSettings;
  
  // Actions
  addSessions: (sessions: Session[]) => void;
  clearSessions: () => void;
  updateFilters: (filters: Partial<SessionFilters>) => void;
  resetFilters: () => void;
  deleteSession: (sessionId: string) => void;
  updateChartSettings: (settings: Partial<ChartSettings>) => void;
  resetChartSettings: () => void;
  
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

const defaultChartSettings: ChartSettings = {
  enabledCharts: ['distance', 'power', 'pace'],
  chartType: 'line'
};

// Calculate personal records from sessions
function calculatePersonalRecords(sessions: Session[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  
  // Standard distances to track
  const distances = [500, 1000, 2000, 5000];
  
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
      // Initial state
      sessions: [],
      personalRecords: [],
      filters: defaultFilters,
      chartSettings: defaultChartSettings,

      // Actions
      addSessions: (newSessions) => {
        set((state) => {
          const existingIds = new Set(state.sessions.map(s => s.id));
          const uniqueNewSessions = newSessions.filter(s => !existingIds.has(s.id));
          
          const updatedSessions = [...state.sessions, ...uniqueNewSessions];
          const updatedRecords = calculatePersonalRecords(updatedSessions);
          
          return {
            sessions: updatedSessions,
            personalRecords: updatedRecords
          };
        });
      },

      clearSessions: () => {
        set({
          sessions: [],
          personalRecords: []
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

      updateChartSettings: (newSettings) => {
        set((state) => ({
          chartSettings: { ...state.chartSettings, ...newSettings }
        }));
      },

      resetChartSettings: () => {
        set({ chartSettings: defaultChartSettings });
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
        chartSettings: state.chartSettings
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
        }
      }
    }
  )
);
