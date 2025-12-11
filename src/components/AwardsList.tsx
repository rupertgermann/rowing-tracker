'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRowingStore } from '@/lib/store';
import { useAchievementStore } from '@/lib/achievementStore';
import { AWARDS } from '@/lib/awards';
import { getAchievementImage } from '@/lib/imageStorage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { cardStyles, getShadowStyle, getCardClassName } from '@/lib/cardStyles';
import { formatDateOnly } from '@/lib/dateTimeUtils';
import { AchievementGallery } from './AchievementGallery';

export function AwardsList() {
  const { earnedAwards } = useRowingStore();
  const { hasGeneratedContent, generatedAchievements } = useAchievementStore();
  const earnedIds = new Set(earnedAwards.map(a => a.awardId));
  
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedAwardId, setSelectedAwardId] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, string>>({});

  // Load images from filesystem for awards that have them
  useEffect(() => {
    const loadImages = async () => {
      const imagePromises = AWARDS.filter(award => {
        const achievement = generatedAchievements[award.id];
        return achievement?.hasImage || achievement?.imageUrl;
      }).map(async (award) => {
        const achievement = generatedAchievements[award.id];
        // Use in-memory imageUrl if available, otherwise check filesystem
        if (achievement?.imageUrl) {
          return { awardId: award.id, imageData: achievement.imageUrl };
        }
        const imagePath = await getAchievementImage(award.id);
        return { awardId: award.id, imageData: imagePath };
      });

      const results = await Promise.all(imagePromises);
      const imageMap: Record<string, string> = {};
      results.forEach(({ awardId, imageData }) => {
        if (imageData) {
          imageMap[awardId] = imageData;
        }
      });
      setLoadedImages(imageMap);
    };

    loadImages();
  }, [generatedAchievements]);

  const handleAwardClick = (awardId: string, isEarned: boolean) => {
    if (isEarned) {
      setSelectedAwardId(awardId);
      setGalleryOpen(true);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {AWARDS.map((award, index) => {
          const isEarned = earnedIds.has(award.id);
          const Icon = award.icon;
          const earnedInfo = earnedAwards.find(a => a.awardId === award.id);
          const hasContent = hasGeneratedContent(award.id);
          
          // Use base imageUrl without version param to allow Next.js optimization
          // Cache busting handled in gallery detail view, not needed for list thumbnails
          const imageUrl = loadedImages[award.id];
          
          return (
            <Card 
              key={award.id} 
              onClick={() => handleAwardClick(award.id, isEarned)}
              className={cn(
                "group transition-all duration-200",
                isEarned 
                  ? getCardClassName('purple', true)
                  : "opacity-60 grayscale border-dashed bg-muted/30 relative overflow-hidden h-full",
                hasContent && "ring-2 ring-purple-500/30"
              )}
              style={isEarned ? getShadowStyle('purple') : undefined}
            >
              {/* Background Image with Gradient Overlay - optimized thumbnails */}
              {imageUrl && isEarned && (
                <>
                  <div className="absolute inset-0">
                    <Image
                      src={imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      className="object-cover"
                      quality={60}
                      priority={index < 4} // First row loads eagerly for LCP
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/90 to-background/10 opacity-90 transition-opacity duration-200 group-hover:opacity-70" />
                </>
              )}
              
              {/* Card Content */}
              <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0 gap-2 relative z-10">
                <div className={cn(
                  "p-2 rounded-full",
                  isEarned ? "bg-background/80 shadow-sm backdrop-blur-sm" : "bg-transparent"
                )}>
                  <Icon 
                    className={cn(
                      "h-6 w-6", 
                      isEarned ? award.color : "text-muted-foreground"
                    )} 
                  />
                </div>
                <div className="flex items-center gap-1">
                  {isEarned && earnedInfo && (
                    <span className="text-[10px] text-muted-foreground font-mono bg-background/80 px-1.5 py-0.5 rounded border backdrop-blur-sm">
                      {formatDateOnly(new Date(earnedInfo.earnedAt))}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <CardTitle className="text-base mb-1 leading-tight">{award.title}</CardTitle>
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {award.description}
                </p>
                {isEarned && (
                  <p className="text-[10px] text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to view & generate story
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <AchievementGallery 
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        initialAwardId={selectedAwardId}
      />
    </>
  );
}
