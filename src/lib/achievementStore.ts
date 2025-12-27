import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GeneratedAchievement } from '@/types/achievement';

// Note: Images are stored as files in public/assets/awards/ via imageStorage.ts
// The store keeps the file path (imageUrl) and a hasImage flag
// This avoids localStorage quota issues with large base64 images
//
// Note: Achievement generation settings (prompts, image style, etc.) are stored
// in the database via UserSettings.aiConfig and accessed via settings.getAISettings().
// This store only manages UI state and in-memory achievement data loaded from DB.

interface AchievementStore {
  // Generated achievements keyed by awardId (loaded from database on app init)
  // Note: imageUrl contains the file path (e.g., /assets/awards/award_id.png)
  generatedAchievements: Record<string, GeneratedAchievement>;
  
  // Currently selected achievement for gallery view (UI state)
  selectedAchievementId: string | null;
  
  // Gallery open state (UI state)
  isGalleryOpen: boolean;
  
  // Actions
  setGeneratedAchievement: (awardId: string, achievement: Partial<GeneratedAchievement>) => void;
  updateGeneratedAchievement: (awardId: string, updates: Partial<GeneratedAchievement>) => void;
  removeGeneratedAchievement: (awardId: string) => void;
  clearAllGeneratedAchievements: () => void;
  
  // Gallery actions
  openGallery: (awardId?: string) => void;
  closeGallery: () => void;
  selectAchievement: (awardId: string | null) => void;
  
  // Getters
  getGeneratedAchievement: (awardId: string) => GeneratedAchievement | undefined;
  hasGeneratedContent: (awardId: string) => boolean;
}

export const useAchievementStore = create<AchievementStore>()(
  persist(
    (set, get) => ({
      generatedAchievements: {},
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
        // Only persist UI state to localStorage
        // Generated achievements are loaded from database on app init
        selectedAchievementId: state.selectedAchievementId,
        isGalleryOpen: state.isGalleryOpen,
      }),
    }
  )
);
