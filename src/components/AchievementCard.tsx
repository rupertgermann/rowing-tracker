'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Award } from '@/lib/awards';
import { useAchievementStore } from '@/lib/achievementStore';
import { settings } from '@/lib/settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDateOnly } from '@/lib/dateTimeUtils';
import { 
  Sparkles, 
  RefreshCw, 
  ImageIcon, 
  BookOpen,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface AchievementCardProps {
  award: Award;
  earnedAt?: Date;
  isEarned: boolean;
  onClick?: () => void;
  showGenerateButton?: boolean;
  compact?: boolean;
}

export function AchievementCard({ 
  award, 
  earnedAt, 
  isEarned, 
  onClick,
  showGenerateButton = true,
  compact = false
}: AchievementCardProps) {
  const Icon = award.icon;
  const { 
    generatedAchievements, 
    setGeneratedAchievement, 
    updateGeneratedAchievement,
    hasGeneratedContent 
  } = useAchievementStore();
  
  const generated = generatedAchievements[award.id];
  const hasContent = hasGeneratedContent(award.id);
  
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateStory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEarned) return;
    
    setIsGeneratingStory(true);
    setError(null);
    
    try {
      const aiSettings = settings.getAISettings();
      
      const response = await fetch('/api/achievements/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: award.title,
          description: award.description,
          earnedAt: earnedAt ? formatDateOnly(earnedAt) : formatDateOnly(new Date()),
          customPrompt: aiSettings.achievementStoryPrompt,
          apiKey: aiSettings.openaiApiKey || undefined,
          // If an image already exists, pass it for better coherence
          imageUrl: generated?.imageUrl
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate story');
      }
      
      const data = await response.json();
      
      setGeneratedAchievement(award.id, {
        awardId: award.id,
        title: award.title,
        description: award.description,
        earnedAt: earnedAt || new Date(),
        story: data.story,
        generatedAt: new Date()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate story');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleGenerateImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEarned) return;
    
    setIsGeneratingImage(true);
    setError(null);
    
    try {
      const aiSettings = settings.getAISettings();
      
      const response = await fetch('/api/achievements/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: award.title,
          description: award.description,
          customPrompt: aiSettings.achievementImagePrompt,
          apiKey: aiSettings.openaiApiKey || undefined,
          model: aiSettings.achievementImageModel,
          quality: aiSettings.achievementImageQuality,
          size: aiSettings.achievementImageSize,
          // If a story already exists, pass it for better coherence
          story: generated?.story
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate image');
      }
      
      const data = await response.json();
      
      updateGeneratedAchievement(award.id, {
        imageUrl: data.imageUrl,
        imagePrompt: data.revisedPrompt,
        generatedAt: new Date()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateBoth = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEarned) return;
    
    // Generate story first, then image
    await handleGenerateStory(e);
    await handleGenerateImage(e);
  };

  if (compact) {
    return (
      <Card 
        className={cn(
          "transition-all duration-200 h-full cursor-pointer hover:shadow-md",
          isEarned 
            ? "border-primary/20 bg-secondary/10 shadow-sm" 
            : "opacity-60 grayscale border-dashed bg-muted/30",
          hasContent && "ring-2 ring-primary/30"
        )}
        onClick={onClick}
      >
        <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0 gap-2">
          <div className={cn(
            "p-2 rounded-full",
            isEarned ? "bg-background shadow-sm" : "bg-transparent"
          )}>
            <Icon 
              className={cn(
                "h-6 w-6", 
                isEarned ? award.color : "text-muted-foreground"
              )} 
            />
          </div>
          <div className="flex items-center gap-1">
            {hasContent && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                <Sparkles className="h-3 w-3 mr-0.5" />
                AI
              </Badge>
            )}
            {isEarned && earnedAt && (
              <span className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border">
                {formatDateOnly(earnedAt)}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <CardTitle className="text-base mb-1 leading-tight">{award.title}</CardTitle>
          <p className="text-xs text-muted-foreground line-clamp-3">
            {award.description}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(
        "transition-all duration-200 cursor-pointer hover:shadow-lg",
        isEarned 
          ? "border-primary/20 bg-gradient-to-br from-secondary/20 via-background to-transparent shadow-md" 
          : "opacity-60 grayscale border-dashed bg-muted/30",
        hasContent && "ring-2 ring-primary/40"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className={cn(
            "p-3 rounded-xl",
            isEarned ? "bg-background shadow-md" : "bg-transparent"
          )}>
            <Icon 
              className={cn(
                "h-8 w-8", 
                isEarned ? award.color : "text-muted-foreground"
              )} 
            />
          </div>
          <div className="flex flex-col items-end gap-1">
            {hasContent && (
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Generated
              </Badge>
            )}
            {isEarned && earnedAt && (
              <span className="text-xs text-muted-foreground font-mono">
                {formatDateOnly(earnedAt)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <CardTitle className="text-xl mb-2">{award.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {award.description}
          </p>
        </div>

        {/* Generated Image Preview */}
        {generated?.imageUrl && (
          <div className="relative aspect-square w-full rounded-lg overflow-hidden border">
            <Image
              src={generated.imageUrl}
              alt={award.title}
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Generated Story Preview */}
        {generated?.story && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="line-clamp-4 text-muted-foreground italic">
              {generated.story}
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Generate Buttons */}
        {isEarned && showGenerateButton && (
          <div className="flex flex-wrap gap-2 pt-2">
            {!hasContent ? (
              <Button
                size="sm"
                onClick={handleGenerateBoth}
                disabled={isGeneratingStory || isGeneratingImage}
                className="flex-1"
              >
                {(isGeneratingStory || isGeneratingImage) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Story & Image
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateStory}
                  disabled={isGeneratingStory}
                >
                  {isGeneratingStory ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      <BookOpen className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage}
                >
                  {isGeneratingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      <ImageIcon className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
