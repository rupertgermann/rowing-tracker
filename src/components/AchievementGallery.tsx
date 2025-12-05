'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { AWARDS } from '@/lib/awards';
import { useAchievementStore } from '@/lib/achievementStore';
import { useRowingStore } from '@/lib/store';
import { settings } from '@/lib/settings';
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
  
  // Get only earned awards
  const earnedAwardIds = new Set(earnedAwards.map(a => a.awardId));
  const earnedAwardsList = AWARDS.filter(a => earnedAwardIds.has(a.id));
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set initial index when dialog opens
  useEffect(() => {
    if (open && initialAwardId) {
      const index = earnedAwardsList.findIndex(a => a.id === initialAwardId);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [open, initialAwardId, earnedAwardsList]);

  const currentAward = earnedAwardsList[currentIndex];
  const earnedInfo = earnedAwards.find(a => a.awardId === currentAward?.id);
  const generated = currentAward ? generatedAchievements[currentAward.id] : undefined;
  const Icon = currentAward?.icon;

  const goToPrevious = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? earnedAwardsList.length - 1 : prev - 1
    );
    setError(null);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => 
      prev === earnedAwardsList.length - 1 ? 0 : prev + 1
    );
    setError(null);
  };

  const handleGenerateStory = async () => {
    if (!currentAward) return;
    
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate story');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!currentAward) return;
    
    setIsGeneratingImage(true);
    setError(null);
    
    try {
      const aiSettings = settings.getAISettings();
      
      const response = await fetch('/api/achievements/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentAward.title,
          description: currentAward.description,
          customPrompt: aiSettings.achievementImagePrompt,
          apiKey: aiSettings.openaiApiKey || undefined
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate image');
      }
      
      const data = await response.json();
      
      if (generated) {
        updateGeneratedAchievement(currentAward.id, {
          imageUrl: data.imageUrl,
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
    await handleGenerateStory();
    await handleGenerateImage();
  };

  const handleDownloadImage = () => {
    if (!generated?.imageUrl) return;
    
    const link = document.createElement('a');
    link.href = generated.imageUrl;
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
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-6 py-4">
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
            <div className="flex items-center gap-2">
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

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Generated Image */}
          {generated?.imageUrl ? (
            <div className="relative aspect-square max-w-lg mx-auto rounded-xl overflow-hidden border shadow-lg">
              <Image
                src={generated.imageUrl}
                alt={currentAward.title}
                fill
                className="object-cover"
              />
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
            <div className="aspect-square max-w-lg mx-auto rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-4 bg-muted/20">
              <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">
                No image generated yet
              </p>
            </div>
          )}

          {/* Generated Story */}
          <div className="max-w-2xl mx-auto">
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
            {!generated?.story && !generated?.imageUrl ? (
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
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage}
                >
                  {isGeneratingImage ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Regenerate Image
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Navigation */}
        {earnedAwardsList.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur border shadow-lg hover:bg-muted transition-colors"
              aria-label="Previous achievement"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur border shadow-lg hover:bg-muted transition-colors"
              aria-label="Next achievement"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Thumbnail Navigation */}
        {earnedAwardsList.length > 1 && (
          <div className="border-t px-6 py-4">
            <div className="flex flex-wrap gap-2 justify-center">
              {earnedAwardsList.map((award, index) => {
                const AwardIcon = award.icon;
                const hasGenerated = generatedAchievements[award.id]?.story || 
                                     generatedAchievements[award.id]?.imageUrl;
                return (
                  <button
                    key={award.id}
                    onClick={() => {
                      setCurrentIndex(index);
                      setError(null);
                    }}
                    className={cn(
                      "flex-shrink-0 p-2 rounded-lg border transition-all",
                      index === currentIndex 
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30" 
                        : "border-muted hover:border-muted-foreground/50",
                      hasGenerated && "ring-1 ring-purple-500/30"
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
      </DialogContent>
    </Dialog>
  );
}
