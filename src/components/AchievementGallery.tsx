'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { AWARDS } from '@/lib/awards';
import { useAchievementStore } from '@/lib/achievementStore';
import { useRowingStore } from '@/lib/store';
import { settings } from '@/lib/settings';
import { storeAchievementImage, getAchievementImage, deleteAchievementImage } from '@/lib/imageStorage';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDateOnly } from '@/lib/dateTimeUtils';
import { 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  RefreshCw, 
  ImageIcon, 
  BookOpen,
  Loader2,
  AlertCircle,
  Download
} from 'lucide-react';

function getAchievementImageSizing(size?: string) {
  switch (size) {
    case '1024x1536':
      return { aspect: 'aspect-[2/3]', maxWidth: 'max-w-xl' }; // portrait
    case '1536x1024':
      return { aspect: 'aspect-[3/2]', maxWidth: 'max-w-4xl' }; // landscape
    default:
      return { aspect: 'aspect-square', maxWidth: 'max-w-lg' };
  }
}

interface AchievementGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAwardId?: string | null;
}

export function AchievementGallery({ 
  open, 
  onOpenChange, 
  initialAwardId 
}: AchievementGalleryProps) {
  const { earnedAwards } = useRowingStore();
  const { 
    generatedAchievements, 
    setGeneratedAchievement, 
    updateGeneratedAchievement 
  } = useAchievementStore();
  const aiSettings = settings.getAISettings();
  const imageSizing = getAchievementImageSizing(aiSettings.achievementImageSize);
  
  // Memoize earned awards list to prevent recreation on every render
  const earnedAwardsList = useMemo(() => {
    const earnedAwardIds = new Set(earnedAwards.map(a => a.awardId));
    return AWARDS.filter(a => earnedAwardIds.has(a.id));
  }, [earnedAwards]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  // Derived state - must be before useEffects that depend on it
  const currentAward = earnedAwardsList[currentIndex];
  const earnedInfo = earnedAwards.find(a => a.awardId === currentAward?.id);
  const generated = currentAward ? generatedAchievements[currentAward.id] : undefined;
  const Icon = currentAward?.icon;

  // Set initial index only when dialog opens with a specific award
  useEffect(() => {
    if (open && initialAwardId) {
      const index = earnedAwardsList.findIndex(a => a.id === initialAwardId);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [open, initialAwardId]); // Remove earnedAwardsList from deps - it's stable now

  // Load image from IndexedDB when current award changes
  useEffect(() => {
    const loadImage = async () => {
      if (!currentAward) {
        setLoadedImageUrl(null);
        return;
      }

      const achievement = generatedAchievements[currentAward.id];
      
      // If we have imageUrl in memory, use it
      if (achievement?.imageUrl) {
        setLoadedImageUrl(achievement.imageUrl);
        return;
      }
      
      // If hasImage flag is set, load from IndexedDB
      if (achievement?.hasImage) {
        setIsLoadingImage(true);
        try {
          const imageData = await getAchievementImage(currentAward.id);
          if (imageData) {
            setLoadedImageUrl(imageData);
            // Also update the store with the loaded image
            updateGeneratedAchievement(currentAward.id, { imageUrl: imageData });
          } else {
            setLoadedImageUrl(null);
          }
        } catch (err) {
          console.error('Failed to load image from IndexedDB:', err);
          setLoadedImageUrl(null);
        } finally {
          setIsLoadingImage(false);
        }
      } else {
        setLoadedImageUrl(null);
      }
    };

    loadImage();
  }, [currentAward, generatedAchievements, updateGeneratedAchievement]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => {
      const newIndex = prev === 0 ? earnedAwardsList.length - 1 : prev - 1;
      return newIndex;
    });
    setError(null);
  }, [earnedAwardsList.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const newIndex = prev === earnedAwardsList.length - 1 ? 0 : prev + 1;
      return newIndex;
    });
    setError(null);
  }, [earnedAwardsList.length]);

  const selectAward = useCallback((index: number) => {
    setCurrentIndex(index);
    setError(null);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, goToPrevious, goToNext]);

  // Returns the generated story text so it can be passed to image generation
  const handleGenerateStory = async (): Promise<string | null> => {
    if (!currentAward) return null;
    
    setIsGeneratingStory(true);
    setError(null);
    
    try {
      const aiSettings = settings.getAISettings();
      
      const response = await fetch('/api/achievements/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentAward.title,
          description: currentAward.description,
          earnedAt: earnedInfo?.earnedAt 
            ? formatDateOnly(new Date(earnedInfo.earnedAt)) 
            : formatDateOnly(new Date()),
          customPrompt: aiSettings.achievementStoryPrompt,
          apiKey: aiSettings.openaiApiKey || undefined
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate story');
      }
      
      const data = await response.json();
      
      setGeneratedAchievement(currentAward.id, {
        awardId: currentAward.id,
        title: currentAward.title,
        description: currentAward.description,
        earnedAt: earnedInfo?.earnedAt ? new Date(earnedInfo.earnedAt) : new Date(),
        story: data.story,
        generatedAt: new Date()
      });
      
      return data.story;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate story');
      return null;
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // storyOverride allows passing freshly generated story directly (for handleGenerateBoth)
  const handleGenerateImage = async (storyOverride?: string | null) => {
    if (!currentAward) return;
    
    setIsGeneratingImage(true);
    setError(null);
    
    try {
      const aiSettings = settings.getAISettings();
      
      // Use storyOverride if provided, otherwise fall back to stored story
      const storyToUse = storyOverride !== undefined ? storyOverride : generated?.story;
      
      const requestBody = {
        title: currentAward.title,
        description: currentAward.description,
        customPrompt: aiSettings.achievementImagePrompt,
        apiKey: aiSettings.openaiApiKey || undefined,
        model: aiSettings.achievementImageModel,
        quality: aiSettings.achievementImageQuality,
        size: aiSettings.achievementImageSize,
        // If a story already exists, pass it for better coherence
        story: storyToUse
      };
      if (process.env.NODE_ENV === 'development') {
        console.log('[AchievementGallery] image request body', {
          ...requestBody,
          storyPreview: requestBody.story?.slice?.(0, 120) || null,
          hasStory: Boolean(requestBody.story)
        });
      }

      const response = await fetch('/api/achievements/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate image');
      }
      
      const data = await response.json();
      
      // Store image in IndexedDB (avoids localStorage quota issues)
      await storeAchievementImage(currentAward.id, data.imageUrl);
      
      // Update local state immediately
      setLoadedImageUrl(data.imageUrl);
      
      // Update store with hasImage flag (imageUrl will be stripped on persist)
      if (generated) {
        updateGeneratedAchievement(currentAward.id, {
          imageUrl: data.imageUrl,
          hasImage: true,
          imagePrompt: data.revisedPrompt,
          generatedAt: new Date()
        });
      } else {
        setGeneratedAchievement(currentAward.id, {
          awardId: currentAward.id,
          title: currentAward.title,
          description: currentAward.description,
          earnedAt: earnedInfo?.earnedAt ? new Date(earnedInfo.earnedAt) : new Date(),
          imageUrl: data.imageUrl,
          hasImage: true,
          imagePrompt: data.revisedPrompt,
          generatedAt: new Date()
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateBoth = async () => {
    // Generate story first, then pass it directly to image generation
    const generatedStory = await handleGenerateStory();
    await handleGenerateImage(generatedStory);
  };

  const handleResetStory = async () => {
    if (!currentAward) return;
    updateGeneratedAchievement(currentAward.id, {
      story: undefined,
      error: undefined,
      generatedAt: new Date()
    });
  };

  const handleResetImage = async () => {
    if (!currentAward) return;
    await deleteAchievementImage(currentAward.id);
    setLoadedImageUrl(null);
    updateGeneratedAchievement(currentAward.id, {
      imageUrl: undefined,
      hasImage: false,
      imagePrompt: undefined,
      error: undefined,
      generatedAt: new Date()
    });
  };

  const handleDownloadImage = () => {
    if (!loadedImageUrl) return;
    
    const link = document.createElement('a');
    link.href = loadedImageUrl;
    link.download = `${currentAward?.title.replace(/\s+/g, '_')}_achievement.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (earnedAwardsList.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>No Achievements Yet</DialogTitle>
            <DialogDescription>
              Complete rowing sessions to earn achievements and unlock AI-generated stories and images!
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  if (!currentAward) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[99vh] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-background border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className={cn("p-2 rounded-lg bg-muted")}>
                  <Icon className={cn("h-6 w-6", currentAward.color)} />
                </div>
              )}
              <div>
                <DialogTitle className="text-xl">{currentAward.title}</DialogTitle>
                <DialogDescription className="text-sm">
                  {currentAward.description}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 mr-8">
              {earnedInfo?.earnedAt && (
                <Badge variant="secondary" className="font-mono">
                  Earned: {formatDateOnly(new Date(earnedInfo.earnedAt))}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {earnedAwardsList.length}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Generated Image */}
          {isLoadingImage ? (
            <div className={`${imageSizing.aspect} ${imageSizing.maxWidth} mx-auto rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-4 bg-muted/20`}>
              <Loader2 className="h-12 w-12 text-muted-foreground/50 animate-spin" />
              <p className="text-muted-foreground text-sm">
                Loading image...
              </p>
            </div>
          ) : loadedImageUrl ? (
            <div className={`relative ${imageSizing.aspect} ${imageSizing.maxWidth} mx-auto rounded-xl overflow-hidden border shadow-lg`}>
              <Image
                src={loadedImageUrl}
                alt={currentAward.title}
                fill
                className="object-cover"
              />
              {isGeneratingImage && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Updating image...</p>
                </div>
              )}
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDownloadImage}
                  className="bg-background/80 backdrop-blur"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className={`${imageSizing.aspect} ${imageSizing.maxWidth} mx-auto rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-4 bg-muted/20 relative`}>
              {isGeneratingImage ? (
                <>
                  <Loader2 className="h-12 w-12 text-muted-foreground/50 animate-spin" />
                  <p className="text-muted-foreground text-sm">
                    Creating image...
                  </p>
                </>
              ) : (
                <>
                  <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
                  <p className="text-muted-foreground text-sm">
                    No image generated yet
                  </p>
                </>
              )}
            </div>
          )}

          {/* Generated Story */}
          <div className={`${imageSizing.maxWidth} mx-auto`}>
            {generated?.story ? (
              <div className="bg-gradient-to-br from-muted/50 to-muted/20 rounded-xl p-6 border">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Your Achievement Story</h3>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {generated.story.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-muted-foreground leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
                {generated.generatedAt && (
                  <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
                    Generated on {formatDateOnly(new Date(generated.generatedAt))}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-muted/20 rounded-xl p-6 border-2 border-dashed border-muted-foreground/30 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  No story generated yet
                </p>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="max-w-2xl mx-auto flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="max-w-2xl mx-auto flex flex-wrap justify-center gap-3">
            {!generated?.story && !loadedImageUrl && !generated?.hasImage ? (
              <Button
                onClick={handleGenerateBoth}
                disabled={isGeneratingStory || isGeneratingImage}
                size="lg"
                className="min-w-[200px]"
              >
                {(isGeneratingStory || isGeneratingImage) ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    {isGeneratingStory ? 'Writing Story...' : 'Creating Image...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generate Story & Image
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleGenerateStory}
                  disabled={isGeneratingStory}
                >
                  {isGeneratingStory ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Regenerate Story
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResetStory}
                  disabled={isGeneratingStory}
                >
                  Reset Story
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleGenerateImage()}
                  disabled={isGeneratingImage}
                >
                  {isGeneratingImage ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Regenerate Image
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResetImage}
                  disabled={isGeneratingImage}
                >
                  Reset Image
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Thumbnail Navigation - Fixed at bottom */}
        {earnedAwardsList.length > 1 && (
          <div className="flex-shrink-0 border-t px-6 py-4 bg-background">
            <div className="flex flex-wrap gap-2 justify-center">
              {earnedAwardsList.map((award, index) => {
                const AwardIcon = award.icon;
                const hasGenerated = generatedAchievements[award.id]?.story || 
                                     generatedAchievements[award.id]?.imageUrl;
                return (
                  <button
                    key={award.id}
                    type="button"
                    onClick={() => selectAward(index)}
                    className={cn(
                      "flex-shrink-0 p-2 rounded-lg border transition-all cursor-pointer",
                      index === currentIndex 
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30" 
                        : "border-muted hover:border-muted-foreground/50 hover:bg-muted/50",
                      hasGenerated && index !== currentIndex && "ring-1 ring-purple-500/30"
                    )}
                    title={award.title}
                  >
                    <AwardIcon className={cn("h-5 w-5", award.color)} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation Arrows - Fixed position relative to dialog */}
        {earnedAwardsList.length > 1 && (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-background border-2 shadow-lg hover:bg-muted transition-colors cursor-pointer"
              aria-label="Previous achievement"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="absolute right-12 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-background border-2 shadow-lg hover:bg-muted transition-colors cursor-pointer"
              aria-label="Next achievement"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
