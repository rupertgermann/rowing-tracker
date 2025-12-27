'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { AWARDS, Award } from '@/lib/awards';
import { useAchievementStore } from '@/lib/achievementStore';
import { useRowingStore, AIAwardSuggestion } from '@/lib/store';
import { settings } from '@/lib/settings';
import { storeAchievementImage, getAchievementImage, deleteAchievementImage } from '@/lib/imageStorage';
import { fetchGeneratedAchievementsFromDB, saveGeneratedAchievementsToDB } from '@/lib/dataSync';
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

// Unified gallery item for both static awards and AI awards
interface GalleryAward {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  earnedAt: Date;
  isAIAward: boolean;
  sourceAward?: Award;
  aiSuggestion?: AIAwardSuggestion;
}

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
  const { earnedAwards, aiAwardSuggestions } = useRowingStore();
  const { 
    generatedAchievements, 
    setGeneratedAchievement, 
    updateGeneratedAchievement 
  } = useAchievementStore();
  const aiSettings = settings.getAISettings();
  const imageSizing = getAchievementImageSizing(aiSettings.achievementImageSize);
  
  // Memoize earned awards list (static + AI) to prevent recreation on every render
  const earnedAwardsList = useMemo((): GalleryAward[] => {
    const earnedAwardIds = new Set(earnedAwards.map(a => a.awardId));
    
    // Static awards that are earned
    const staticItems: GalleryAward[] = AWARDS
      .filter(a => earnedAwardIds.has(a.id))
      .map(award => {
        const earnedInfo = earnedAwards.find(e => e.awardId === award.id);
        return {
          id: award.id,
          title: award.title,
          description: award.description,
          icon: award.icon,
          color: award.color,
          earnedAt: earnedInfo?.earnedAt ? new Date(earnedInfo.earnedAt) : new Date(),
          isAIAward: false,
          sourceAward: award
        };
      });
    
    // AI awards that are earned
    const aiItems: GalleryAward[] = aiAwardSuggestions
      .filter(s => s.status === 'earned')
      .map(suggestion => ({
        id: suggestion.id,
        title: suggestion.title,
        description: suggestion.description,
        icon: Sparkles,
        color: 'text-purple-500',
        earnedAt: suggestion.earnedAt ? new Date(suggestion.earnedAt) : new Date(),
        isAIAward: true,
        aiSuggestion: suggestion
      }));
    
    return [...staticItems, ...aiItems];
  }, [earnedAwards, aiAwardSuggestions]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageLoadingMessage, setImageLoadingMessage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load generated achievements from DB when gallery opens (DB wins)
  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        const dbAchievements = await fetchGeneratedAchievementsFromDB();
        for (const a of dbAchievements) {
          if (!a?.awardId) continue;
          updateGeneratedAchievement(a.awardId, {
            story: a.story || undefined,
            imageUrl: a.imageUrl || undefined,
            hasImage: Boolean(a.hasImage) || Boolean(a.imageUrl),
            earnedAt: a.earnedAt ? new Date(a.earnedAt) : undefined,
            generatedAt: a.generatedAt ? new Date(a.generatedAt) : undefined,
          });
        }
      } catch (e) {
        // Non-fatal; gallery can still work without DB data
        if (process.env.NODE_ENV === 'development') {
          console.warn('[AchievementGallery] Failed to load generated achievements from DB', e);
        }
      }
    };

    load();
  }, [open, updateGeneratedAchievement]);

  // Fun rowing-themed loading messages
  const loadingMessages = [
    "🚣 Warming up the oars...",
    "🎨 Mixing the perfect colors...",
    "🌊 Catching the perfect wave...",
    "✨ Adding some magic sparkles...",
    "🏆 Polishing your trophy...",
    "🖼️ Framing your achievement...",
    "💪 Flexing those artistic muscles...",
    "🌅 Painting the sunrise...",
    "🎭 Striking a heroic pose...",
    "🔥 Making it legendary..."
  ];

  // Cycle through loading messages
  useEffect(() => {
    if (!isGeneratingImage) {
      setImageLoadingMessage(0);
      return;
    }
    const interval = setInterval(() => {
      setImageLoadingMessage(prev => (prev + 1) % loadingMessages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isGeneratingImage, loadingMessages.length]);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  // Derived state - must be before useEffects that depend on it
  const currentAward = earnedAwardsList[currentIndex];
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

  // Load image from filesystem when current award changes
  useEffect(() => {
    const loadImage = async () => {
      if (!currentAward) {
        setLoadedImageUrl(null);
        return;
      }

      const achievement = generatedAchievements[currentAward.id];
      
      // If we have imageUrl in memory (file path), use it
      if (achievement?.imageUrl) {
        setLoadedImageUrl(achievement.imageUrl);
        return;
      }
      
      // If hasImage flag is set, check if file exists on filesystem
      if (achievement?.hasImage) {
        setIsLoadingImage(true);
        try {
          const imagePath = await getAchievementImage(currentAward.id);
          if (imagePath) {
            setLoadedImageUrl(imagePath);
            // Also update the store with the loaded image path
            updateGeneratedAchievement(currentAward.id, { imageUrl: imagePath });
          } else {
            setLoadedImageUrl(null);
          }
        } catch (err) {
          console.error('Failed to load image from filesystem:', err);
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
          earnedAt: currentAward.earnedAt 
            ? formatDateOnly(new Date(currentAward.earnedAt)) 
            : formatDateOnly(new Date()),
          customPrompt: aiSettings.achievementStoryPrompt,
          apiKey: aiSettings.openaiApiKey || undefined,
          model: aiSettings.achievementText?.model || 'gpt-5-mini',
          reasoning: aiSettings.achievementText?.reasoning || 'low',
          verbosity: aiSettings.achievementText?.verbosity || 'medium'
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
        earnedAt: currentAward.earnedAt ? new Date(currentAward.earnedAt) : new Date(),
        story: data.story,
        generatedAt: new Date()
      });

      const saveResult = await saveGeneratedAchievementsToDB([
        {
          awardId: currentAward.id,
          story: data.story,
          earnedAt: currentAward.earnedAt ? new Date(currentAward.earnedAt) : undefined,
          generatedAt: new Date(),
        },
      ]);
      
      if (!saveResult.success) {
        console.error('[AchievementGallery] Failed to save story to DB:', saveResult.error);
        setError(`Failed to save: ${saveResult.error}`);
      }
      
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
        apiKey: aiSettings.openaiApiKey || undefined,
        model: aiSettings.achievementImageModel,
        quality: aiSettings.achievementImageQuality,
        size: aiSettings.achievementImageSize,
        // If a story already exists, pass it for better coherence
        story: storyToUse
      };

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
      
      // Store image to filesystem via API
      const filePath = await storeAchievementImage(currentAward.id, data.imageUrl);
      
      // Update local state with the file path
      setLoadedImageUrl(filePath);
      
      // Update store with file path, hasImage flag, and increment version for cache busting
      const newVersion = (generated?.imageVersion || 0) + 1;
      if (generated) {
        updateGeneratedAchievement(currentAward.id, {
          imageUrl: filePath,
          hasImage: true,
          imagePrompt: data.revisedPrompt,
          imageVersion: newVersion,
          generatedAt: new Date()
        });
      } else {
        setGeneratedAchievement(currentAward.id, {
          awardId: currentAward.id,
          title: currentAward.title,
          description: currentAward.description,
          earnedAt: currentAward.earnedAt ? new Date(currentAward.earnedAt) : new Date(),
          imageUrl: filePath,
          hasImage: true,
          imagePrompt: data.revisedPrompt,
          imageVersion: newVersion,
          generatedAt: new Date()
        });
      }

      const saveResult = await saveGeneratedAchievementsToDB([
        {
          awardId: currentAward.id,
          imageUrl: filePath,
          hasImage: true,
          earnedAt: currentAward.earnedAt ? new Date(currentAward.earnedAt) : undefined,
          generatedAt: new Date(),
        },
      ]);
      
      if (!saveResult.success) {
        console.error('[AchievementGallery] Failed to save image to DB:', saveResult.error);
        setError(`Failed to save: ${saveResult.error}`);
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

    await saveGeneratedAchievementsToDB([
      {
        awardId: currentAward.id,
        story: null,
        generatedAt: new Date(),
      },
    ]);
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

    await saveGeneratedAchievementsToDB([
      {
        awardId: currentAward.id,
        imageUrl: null,
        hasImage: false,
        generatedAt: new Date(),
      },
    ]);
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
              {currentAward.earnedAt && (
                <Badge variant="secondary" className="font-mono">
                  Earned: {formatDateOnly(new Date(currentAward.earnedAt))}
                </Badge>
              )}
              {currentAward.isAIAward && (
                <Badge variant="outline" className="text-purple-500 border-purple-500/30">
                  AI Award
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
                src={generated?.imageVersion ? `${loadedImageUrl}?v=${generated.imageVersion}` : loadedImageUrl}
                alt={currentAward.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
                unoptimized // Bypass Next.js image optimization to allow query string cache busting
              />
              {isGeneratingImage && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  {/* Animated rowing boat - 3x size */}
                  <div className="relative w-96 h-60 overflow-hidden">
                    {/* Water waves - full width */}
                    <div className="absolute bottom-8 left-0 right-0 h-16 overflow-hidden">
                      <div className="animate-pulse flex gap-3 justify-center">
                        {[...Array(8)].map((_, i) => (
                          <div 
                            key={i} 
                            className="w-12 h-6 bg-blue-400/30 rounded-full"
                            style={{ animationDelay: `${i * 0.1}s` }}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Boat emoji with rowing and wandering animation */}
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 text-9xl"
                      style={{ 
                        animation: 'wander 4s linear infinite, bounce 1s ease-in-out infinite'
                      }}
                    >
                      🚣
                    </div>
                    <style jsx>{`
                      @keyframes wander {
                        0% { left: -120px; }
                        100% { left: 100%; }
                      }
                    `}</style>
                  </div>
                  {/* Progress dots */}
                  <div className="flex gap-1.5">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary/60 animate-pulse"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                  {/* Cycling fun message */}
                  <p className="text-sm font-medium text-foreground">
                    {loadingMessages[imageLoadingMessage]}
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    This usually takes 10-20 seconds
                  </p>
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
            <div className={`${imageSizing.aspect} ${imageSizing.maxWidth} mx-auto rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-4 bg-muted/20 relative overflow-hidden`}>
              {isGeneratingImage ? (
                <>
                  {/* Animated rowing boat - 3x size */}
                  <div className="relative w-96 h-60 overflow-hidden">
                    {/* Water waves - full width */}
                    <div className="absolute bottom-8 left-0 right-0 h-16 overflow-hidden">
                      <div className="animate-pulse flex gap-3 justify-center">
                        {[...Array(8)].map((_, i) => (
                          <div 
                            key={i} 
                            className="w-12 h-6 bg-blue-400/30 rounded-full"
                            style={{ animationDelay: `${i * 0.1}s` }}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Boat emoji with rowing and wandering animation */}
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 text-9xl"
                      style={{ 
                        animation: 'wander 4s linear infinite, bounce 1s ease-in-out infinite'
                      }}
                    >
                      🚣
                    </div>
                    <style jsx>{`
                      @keyframes wander {
                        0% { left: -120px; }
                        100% { left: 100%; }
                      }
                    `}</style>
                  </div>
                  {/* Progress dots */}
                  <div className="flex gap-1.5">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary/60 animate-pulse"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                  {/* Cycling fun message */}
                  <p className="text-muted-foreground text-sm font-medium transition-all duration-300">
                    {loadingMessages[imageLoadingMessage]}
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    This usually takes 10-20 seconds
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
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                  <ReactMarkdown>{generated.story}</ReactMarkdown>
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
