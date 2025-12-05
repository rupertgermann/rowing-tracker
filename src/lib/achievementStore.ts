import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GeneratedAchievement, AchievementGeneratorSettings, DEFAULT_ACHIEVEMENT_STORY_PROMPT, DEFAULT_ACHIEVEMENT_IMAGE_PROMPT } from '@/types/achievement';

interface AchievementStore {
  // Generated achievements keyed by awardId
  generatedAchievements: Record<string, GeneratedAchievement>;
  
  // Settings for generation
  settings: AchievementGeneratorSettings;
  
  // Currently selected achievement for gallery view
  selectedAchievementId: string | null;
  
  // Gallery open state
  isGalleryOpen: boolean;
  
  // Actions
  setGeneratedAchievement: (awardId: string, achievement: Partial<GeneratedAchievement>) => void;
  updateGeneratedAchievement: (awardId: string, updates: Partial<GeneratedAchievement>) => void;
  removeGeneratedAchievement: (awardId: string) => void;
  clearAllGeneratedAchievements: () => void;
  
  // Settings actions
  updateSettings: (settings: Partial<AchievementGeneratorSettings>) => void;
  resetSettings: () => void;
  
  // Gallery actions
  openGallery: (awardId?: string) => void;
  closeGallery: () => void;
  selectAchievement: (awardId: string | null) => void;
  
  // Getters
  getGeneratedAchievement: (awardId: string) => GeneratedAchievement | undefined;
  hasGeneratedContent: (awardId: string) => boolean;
}

const defaultSettings: AchievementGeneratorSettings = {
  storySystemPrompt: DEFAULT_ACHIEVEMENT_STORY_PROMPT,
  imagePrompt: DEFAULT_ACHIEVEMENT_IMAGE_PROMPT,
  imageStyle: 'artistic',
  imageSize: '1024x1024'
};

export const useAchievementStore = create<AchievementStore>()(
  persist(
    (set, get) => ({
      generatedAchievements: {},
      settings: defaultSettings,
      selectedAchievementId: null,
      isGalleryOpen: false,
      
      setGeneratedAchievement: (awardId, achievement) => {
        set((state) => ({
          generatedAchievements: {
            ...state.generatedAchievements,
            [awardId]: {
              ...state.generatedAchievements[awardId],
              ...achievement,
              awardId
            } as GeneratedAchievement
          }
        }));
      },
      
      updateGeneratedAchievement: (awardId, updates) => {
        set((state) => {
          const existing = state.generatedAchievements[awardId];
          if (!existing) return state;
          
          return {
            generatedAchievements: {
              ...state.generatedAchievements,
              [awardId]: {
                ...existing,
                ...updates
              }
            }
          };
        });
      },
      
      removeGeneratedAchievement: (awardId) => {
        set((state) => {
          const { [awardId]: removed, ...rest } = state.generatedAchievements;
          return { generatedAchievements: rest };
        });
      },
      
      clearAllGeneratedAchievements: () => {
        set({ generatedAchievements: {} });
      },
      
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }));
      },
      
      resetSettings: () => {
        set({ settings: defaultSettings });
      },
      
      openGallery: (awardId) => {
        set({ 
          isGalleryOpen: true,
          selectedAchievementId: awardId || null
        });
      },
      
      closeGallery: () => {
        set({ isGalleryOpen: false });
      },
      
      selectAchievement: (awardId) => {
        set({ selectedAchievementId: awardId });
      },
      
      getGeneratedAchievement: (awardId) => {
        return get().generatedAchievements[awardId];
      },
      
      hasGeneratedContent: (awardId) => {
        const achievement = get().generatedAchievements[awardId];
        return Boolean(achievement?.story || achievement?.imageUrl);
      }
    }),
    {
      name: 'rowing-achievement-generator',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        generatedAchievements: state.generatedAchievements,
        settings: state.settings
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert date strings back to Date objects
          Object.keys(state.generatedAchievements).forEach(key => {
            const achievement = state.generatedAchievements[key];
            if (achievement.earnedAt) {
              achievement.earnedAt = new Date(achievement.earnedAt);
            }
            if (achievement.generatedAt) {
              achievement.generatedAt = new Date(achievement.generatedAt);
            }
          });
        }
      }
    }
  )
);
