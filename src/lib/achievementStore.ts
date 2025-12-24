import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GeneratedAchievement, AchievementGeneratorSettings, DEFAULT_ACHIEVEMENT_STORY_PROMPT, DEFAULT_ACHIEVEMENT_IMAGE_PROMPT } from '@/types/achievement';

// Note: Images are stored as files in public/assets/awards/ via imageStorage.ts
// The store keeps the file path (imageUrl) and a hasImage flag
// This avoids localStorage quota issues with large base64 images

interface AchievementStore {
  // Generated achievements keyed by awardId
  // Note: imageUrl contains the file path (e.g., /assets/awards/award_id.png)
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
        return Boolean(achievement?.story || achievement?.imageUrl || achievement?.hasImage);
      }
    }),
    {
      name: 'rowing-achievement-generator',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // DB is source of truth for generated achievements. Persist only settings locally.
        settings: state.settings,
        selectedAchievementId: state.selectedAchievementId,
        isGalleryOpen: state.isGalleryOpen,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Ensure we don't carry over stale generated achievements from localStorage
          state.generatedAchievements = {};
        }
      },
    }
  )
);
